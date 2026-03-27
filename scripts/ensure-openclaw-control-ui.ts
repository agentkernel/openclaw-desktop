/**
 * npm `openclaw` packages no longer ship `dist/control-ui/` (see upstream package.json "files").
 * Gateway still serves static assets from that path. This step fetches matching GitHub tag sources
 * (`ui/` + `scripts/ui.js` + repo-root `src/` + `apps/` for OpenClawKit JSON resources), runs `vite build` into
 * `../dist/control-ui`, then deletes those sources
 * and devDependencies so the desktop bundle stays small.
 *
 * Note: Vite 8 + Rolldown native bindings often fail on GitHub `windows-latest`; CI builds UI on Linux
 * and merges `dist/control-ui` before `prepare-bundle` (see release workflow + ci-build-openclaw-control-ui).
 *
 * After `vite build`, we run a desktop-only esbuild pass on `dist/control-ui` (see transpile-control-ui-for-electron)
 * so the UI runs inside Electron without changing upstream OpenClaw sources.
 */

import { createWriteStream, existsSync } from 'node:fs'
import {
  mkdir,
  rm,
  cp,
  writeFile,
  readdir,
  access,
  unlink,
  stat,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFile, execFileSync, execSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
import { transpileControlUiForElectronEmbedded } from './lib/transpile-control-ui-for-electron.ts'
import { applyOpenClawUiLitDecoratorCompatPatches } from './lib/patch-openclaw-ui-lit-decorators.ts'

/** Written after GitHub UI build so cached installs can detect pre-npm / legacy bundles. */
export const CONTROL_UI_ELECTRON_LIT_MARKER = '.electron-lit-compat-v1'

const GITHUB_REPO = 'openclaw/openclaw'

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function gitTagForNpmVersion(version: string): string {
  const v = version.trim()
  if (!v) throw new Error('OpenClaw version is empty')
  return v.startsWith('v') ? v : `v${v}`
}

function tarballUrlForTag(tag: string): string {
  return `https://codeload.github.com/${GITHUB_REPO}/tar.gz/${tag}`
}

/** Full URL override (e.g. mirror). Must be the same tarball as the tag. */
function resolveTarballUrl(tag: string): string {
  const override = process.env.OPENCLAW_SOURCE_TARBALL_URL?.trim()
  if (override) {
    console.log('  [control-ui] using OPENCLAW_SOURCE_TARBALL_URL for source tarball')
    return override
  }
  return tarballUrlForTag(tag)
}

function tarballFetchRetries(): number {
  const n = Number(process.env.OPENCLAW_TARBALL_FETCH_RETRIES ?? '5')
  return Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : 5
}

function tarballFetchTimeoutMs(): number {
  const n = Number(process.env.OPENCLAW_TARBALL_FETCH_TIMEOUT_MS ?? String(30 * 60 * 1000))
  return Number.isFinite(n) && n >= 60_000 ? Math.min(2 * 60 * 60 * 1000, Math.floor(n)) : 30 * 60 * 1000
}

function curlOnPath(): boolean {
  try {
    execFileSync('curl', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Windows `System32\\tar.exe` (bsdtar) often fails extracting GitHub tarballs (e.g. docs paths).
 * Prefer Git for Windows GNU tar, or `OPENCLAW_TAR_EXE` override.
 */
function resolveTarExecutable(): string {
  const override = process.env.OPENCLAW_TAR_EXE?.trim()
  if (override) return override
  if (process.platform !== 'win32') return 'tar'
  const candidates = [
    'C:\\Program Files\\Git\\usr\\bin\\tar.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return 'tar'
}

/**
 * Git for Windows `tar` runs in MSYS; drive-letter paths like `E:\...` break gzip (`Cannot connect to E: resolve failed`).
 * Use `/e/...` style paths for that binary.
 */
function pathsForTarExe(tarExe: string, tgzPath: string, extractDir: string): { tgz: string; cwd: string } {
  const tgz = resolve(tgzPath)
  const cwd = resolve(extractDir)
  if (process.platform !== 'win32') return { tgz, cwd }
  if (!/\\git\\/i.test(tarExe)) return { tgz, cwd }
  const toMsys = (abs: string) => {
    const m = /^([a-zA-Z]):[/\\](.*)$/i.exec(abs)
    if (!m) return abs.replace(/\\/g, '/')
    return `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`
  }
  return { tgz: toMsys(tgz), cwd: toMsys(cwd) }
}

function extractTarGzToDir(tgzPath: string, extractDir: string): void {
  const tarExe = resolveTarExecutable()
  if (tarExe !== 'tar') {
    console.log(`  [control-ui] using ${tarExe} for tarball extract`)
  } else if (process.platform === 'win32') {
    console.warn(
      '  [warn] Git tar not found — using System32 tar (may fail on some archives). Install Git for Windows or set OPENCLAW_TAR_EXE.',
    )
  }
  const { tgz, cwd } = pathsForTarExe(tarExe, tgzPath, extractDir)
  execFileSync(tarExe, ['-xzf', tgz, '-C', cwd], { stdio: 'inherit' })
}

/**
 * Node fetch (Undici) often fails immediately with "terminated" on Windows toward codeload.github.com.
 * Prefer curl when available unless OPENCLAW_TARBALL_USE_FETCH=1.
 */
function tarballDownloadBackend(): 'curl' | 'fetch' {
  if (process.env.OPENCLAW_TARBALL_USE_FETCH === '1') {
    return 'fetch'
  }
  if (process.env.OPENCLAW_TARBALL_USE_CURL === '1') {
    return 'curl'
  }
  if (process.platform === 'win32' && curlOnPath()) {
    return 'curl'
  }
  return 'fetch'
}

async function downloadTarballWithCurl(url: string, dest: string, timeoutMs: number): Promise<void> {
  const out = resolve(dest)
  const maxTimeSec = Math.max(60, Math.ceil(timeoutMs / 1000))
  await unlink(out).catch(() => {})
  try {
    await execFileAsync(
      'curl',
      [
        '-fL',
        '--retry',
        '3',
        '--retry-delay',
        '2',
        '--connect-timeout',
        '120',
        '--max-time',
        String(maxTimeSec),
        '-A',
        'openclaw-desktop-bundle/ensure-control-ui',
        '-o',
        out,
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    )
  } catch (err) {
    await unlink(out).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`curl: ${msg}`)
  }
  const st = await stat(out)
  if (st.size < 10_000) {
    await unlink(out).catch(() => {})
    throw new Error(`curl: downloaded file too small (${st.size} bytes)`)
  }
}

async function findExtractedRepoRoot(extractParent: string): Promise<string> {
  const names = await readdir(extractParent, { withFileTypes: true })
  for (const ent of names) {
    if (!ent.isDirectory()) continue
    const root = join(extractParent, ent.name)
    const uiPkg = join(root, 'ui', 'package.json')
    const uiScript = join(root, 'scripts', 'ui.js')
    if ((await fileExists(uiPkg)) && (await fileExists(uiScript))) {
      return root
    }
  }
  throw new Error(
    `Extracted OpenClaw archive under ${extractParent} has no ui/package.json + scripts/ui.js`,
  )
}

async function downloadTarballToFileOnce(url: string, dest: string, timeoutMs: number): Promise<void> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': 'openclaw-desktop-bundle/ensure-control-ui' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    if (!res.body) {
      throw new Error('response has no body')
    }
    const nodeReadable = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
    await pipeline(nodeReadable, createWriteStream(dest))
  } catch (err) {
    await unlink(dest).catch(() => {})
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`download timed out after ${Math.round(timeoutMs / 1000)}s (${url})`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Stream tarball to disk. On Windows defaults to curl (avoids Undici "terminated"); else Node fetch.
 */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const attempts = tarballFetchRetries()
  const timeoutMs = tarballFetchTimeoutMs()
  let backend = tarballDownloadBackend()
  if (backend === 'curl' && !curlOnPath()) {
    console.warn('  [warn] curl not found on PATH — falling back to Node fetch')
    backend = 'fetch'
  }
  if (backend === 'curl') {
    console.log('  [control-ui] using curl for tarball download (set OPENCLAW_TARBALL_USE_FETCH=1 to force Node fetch)')
  }
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      if (backend === 'curl') {
        await downloadTarballWithCurl(url, dest, timeoutMs)
      } else {
        await downloadTarballToFileOnce(url, dest, timeoutMs)
      }
      const st = await stat(dest)
      if (st.size < 10_000) {
        throw new Error(`downloaded file too small (${st.size} bytes)`)
      }
      return
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`  [warn] tarball download attempt ${i}/${attempts} failed: ${msg}`)
      if (
        backend === 'fetch' &&
        i === 1 &&
        (msg === 'terminated' || msg.includes('terminated')) &&
        curlOnPath()
      ) {
        console.warn('  [warn] switching to curl after fetch "terminated"')
        backend = 'curl'
      }
      if (i < attempts) {
        const backoff = Math.min(20_000, 2000 * 2 ** (i - 1))
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }
  const hint =
    'Check network/VPN/proxy, or set OPENCLAW_SOURCE_TARBALL_URL to a mirror of the same tag tarball. ' +
    'On Windows, curl is used by default (OPENCLAW_TARBALL_USE_FETCH=1 to force Node fetch). ' +
    'Optional: OPENCLAW_TARBALL_FETCH_RETRIES, OPENCLAW_TARBALL_FETCH_TIMEOUT_MS.'
  const last = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`Failed to download OpenClaw sources after ${attempts} attempts (${last}). ${hint}`)
}

/**
 * Fetch OpenClaw `ui/` from GitHub tag matching `npmPackageVersion` and run `vite build`
 * into `openclawRoot/dist/control-ui`. Does not delete sources (caller may clean up).
 */
export async function downloadAndBuildOpenClawControlUiAt(
  openclawRoot: string,
  npmPackageVersion: string,
): Promise<void> {
  const tag = gitTagForNpmVersion(npmPackageVersion)
  const url = resolveTarballUrl(tag)
  console.log(`  [control-ui] fetching ${tag} sources (${url.split('/').slice(0, 3).join('/')}/...)...`)

  const parentTmp = join(openclawRoot, '..', '_openclaw_control_ui_tmp')
  await rm(parentTmp, { recursive: true, force: true })
  await mkdir(parentTmp, { recursive: true })

  const tgzPath = join(parentTmp, 'openclaw-src.tgz')
  const extractDir = join(parentTmp, 'extracted')

  try {
    await downloadToFile(url, tgzPath)
    await mkdir(extractDir, { recursive: true })
    extractTarGzToDir(tgzPath, extractDir)

    const srcRoot = await findExtractedRepoRoot(extractDir)
    const uiSrc = join(srcRoot, 'ui')
    const uiDest = join(openclawRoot, 'ui')
    const sharedSrc = join(srcRoot, 'src')
    const sharedDest = join(openclawRoot, 'src')
    const scriptSrc = join(srcRoot, 'scripts', 'ui.js')
    const scriptDestDir = join(openclawRoot, 'scripts')
    const scriptDest = join(scriptDestDir, 'ui.js')

    await rm(uiDest, { recursive: true, force: true })
    await cp(uiSrc, uiDest, { recursive: true })
    await rm(sharedDest, { recursive: true, force: true })
    await cp(sharedSrc, sharedDest, { recursive: true })

    const appsSrc = join(srcRoot, 'apps')
    const appsDest = join(openclawRoot, 'apps')
    if (await fileExists(appsSrc)) {
      await rm(appsDest, { recursive: true, force: true })
      await cp(appsSrc, appsDest, { recursive: true })
    }

    await mkdir(scriptDestDir, { recursive: true })
    await cp(scriptSrc, scriptDest)

    await applyOpenClawUiLitDecoratorCompatPatches(uiDest)

    console.log('  [control-ui] npm install in ui/ (Vite + deps)...')
    execSync('npm install --no-audit --no-fund', {
      cwd: uiDest,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: '' },
    })

    console.log('  [control-ui] vite build → dist/control-ui')
    execSync('npm run build', {
      cwd: uiDest,
      stdio: 'inherit',
    })

    const controlUiDist = join(openclawRoot, 'dist', 'control-ui')
    await transpileControlUiForElectronEmbedded(controlUiDist)

    await writeFile(join(controlUiDist, CONTROL_UI_ELECTRON_LIT_MARKER), '1\n', 'utf8')

    const indexHtml = join(openclawRoot, 'dist', 'control-ui', 'index.html')
    if (!(await fileExists(indexHtml))) {
      throw new Error(`Control UI build finished but missing: ${indexHtml}`)
    }
  } finally {
    await rm(parentTmp, { recursive: true, force: true })
  }
}

async function removeBundledUiSources(openclawDir: string): Promise<void> {
  const uiDest = join(openclawDir, 'ui')
  const sharedDest = join(openclawDir, 'src')
  const appsDest = join(openclawDir, 'apps')
  const scriptDest = join(openclawDir, 'scripts', 'ui.js')
  const scriptDestDir = join(openclawDir, 'scripts')
  await rm(uiDest, { recursive: true, force: true })
  await rm(sharedDest, { recursive: true, force: true })
  await rm(appsDest, { recursive: true, force: true })
  await rm(scriptDest, { force: true })
  try {
    const rest = await readdir(scriptDestDir)
    if (rest.length === 0) {
      await rm(scriptDestDir, { recursive: true, force: true })
    }
  } catch {
    // ignore
  }
}

/**
 * If `dist/control-ui/index.html` is missing under `openclawDir`, fetch matching GitHub tag sources and build.
 * Strips `ui/` + `src/` + `apps/` + `scripts/ui.js` after a successful build to keep the bundle lean.
 */
export async function ensureOpenClawControlUiBuilt(
  openclawDir: string,
  npmPackageVersion: string,
): Promise<void> {
  const controlUiDist = join(openclawDir, 'dist', 'control-ui')
  const indexHtml = join(controlUiDist, 'index.html')
  const markerPath = join(controlUiDist, CONTROL_UI_ELECTRON_LIT_MARKER)
  if (await fileExists(indexHtml)) {
    if (await fileExists(markerPath)) {
      console.log('  [control-ui] dist/control-ui already present (Electron Lit compat) — skip')
      return
    }
    console.log(
      '  [control-ui] dist/control-ui present but missing Electron Lit compat marker — rebuilding from GitHub...',
    )
    await rm(controlUiDist, { recursive: true, force: true })
  }

  console.log(`  [control-ui] building Control UI from GitHub sources for ${npmPackageVersion}...`)
  await downloadAndBuildOpenClawControlUiAt(openclawDir, npmPackageVersion)

  console.log('  [control-ui] removing ui/ sources and dev install from bundle...')
  await removeBundledUiSources(openclawDir)

  console.log('  [control-ui] OK')
}
