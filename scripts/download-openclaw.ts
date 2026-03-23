/**
 * Pre-install OpenClaw npm package to build/openclaw/
 * Usage: pnpm run download-openclaw [-- <version>]
 * Default: `latest` from npm. Newer npm tarballs omit `dist/control-ui/`; we fetch matching
 * GitHub tag sources and run Vite (see ensure-openclaw-control-ui.ts).
 */

import {
  mkdir,
  rm,
  cp,
  readFile,
  access,
  writeFile,
  readdir,
} from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { ensureOpenClawControlUiBuilt } from './ensure-openclaw-control-ui.ts'

const DEFAULT_VERSION = 'latest'
const BUILD_DIR = join(process.cwd(), 'build')
const OPENCLAW_DIR = join(BUILD_DIR, 'openclaw')
const NODE_EXE = join(BUILD_DIR, 'node', 'node.exe')
const TMP_DIR = join(BUILD_DIR, '_openclaw_tmp')
const VERSION_MARKER = '.openclaw-version'

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function parseMajor(range: string | undefined): number | null {
  if (!range) return null
  const match = range.match(/(\d+)(?:\.\d+)?/)
  if (!match) return null
  const major = Number(match[1])
  return Number.isFinite(major) ? major : null
}

async function readJson<T = unknown>(p: string): Promise<T> {
  return JSON.parse(await readFile(p, 'utf8')) as T
}

async function needsCommanderFix(openclawDir: string): Promise<boolean> {
  try {
    const pkg = await readJson<{ dependencies?: Record<string, string> }>(
      join(openclawDir, 'package.json'),
    )
    const expectedRange = pkg.dependencies?.commander
    const expectedMajor = parseMajor(expectedRange)
    if (!expectedMajor) return false

    const commanderPkgPath = join(openclawDir, 'node_modules', 'commander', 'package.json')
    if (!(await fileExists(commanderPkgPath))) return true

    const commanderPkg = await readJson<{ version?: string }>(commanderPkgPath)
    const installedMajor = parseMajor(commanderPkg.version)
    return installedMajor !== null && installedMajor < expectedMajor
  } catch {
    return false
  }
}

function resolveVersion(requested: string): string {
  if (requested === 'latest') {
    console.log('  [resolve] querying npm registry for latest version...')
    return execSync('npm view openclaw version', { encoding: 'utf8' }).trim()
  }
  return requested.replace(/^v/, '')
}

async function main(): Promise<void> {
  const requestedVersion =
    process.argv[2]?.trim() ||
    process.env.OPENCLAW_DESKTOP_BUNDLE_VERSION?.trim() ||
    DEFAULT_VERSION

  console.log(`\ndownload-openclaw: OpenClaw (${requestedVersion})\n`)

  // Prerequisite: bundled node.exe must exist
  if (!(await fileExists(NODE_EXE))) {
    throw new Error(
      'build/node/node.exe not found. Run "pnpm run download-node" first.',
    )
  }
  console.log('  [ok] build/node/node.exe found')

  const version = resolveVersion(requestedVersion)
  console.log(`  [resolve] target version: ${version}`)

  // Idempotent: skip if already installed with matching version (+ commander + Control UI)
  const markerPath = join(OPENCLAW_DIR, VERSION_MARKER)
  const controlUiIndex = join(OPENCLAW_DIR, 'dist', 'control-ui', 'index.html')
  if (await fileExists(markerPath)) {
    const installed = (await readFile(markerPath, 'utf8')).trim()
    if (installed === version) {
      const commanderMismatch = await needsCommanderFix(OPENCLAW_DIR)
      const hasControlUi = await fileExists(controlUiIndex)
      if (!commanderMismatch && hasControlUi) {
        console.log(
          `  [skip] OpenClaw ${version} already present at ${OPENCLAW_DIR}`,
        )
        return
      }
      if (!commanderMismatch && !hasControlUi) {
        console.log(
          '  [info] dist/control-ui missing — building from GitHub sources for this version...',
        )
        await ensureOpenClawControlUiBuilt(OPENCLAW_DIR, version)
        return
      }
      console.log(
        `  [info] OpenClaw ${version} present but commander version mismatch — re-installing`,
      )
    } else {
      console.log(`  [info] Found ${installed}, need ${version} — re-installing`)
    }
    await rm(OPENCLAW_DIR, { recursive: true, force: true })
  }

  // Prepare temp directory
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })
  await writeFile(
    join(TMP_DIR, 'package.json'),
    JSON.stringify({ private: true, name: 'openclaw-bundle' }),
    'utf8',
  )

  // npm install
  console.log(`  [install] npm install openclaw@${version} (this may take a while)...`)
  execSync(`npm install --save openclaw@${version} --no-audit --no-fund`, {
    cwd: TMP_DIR,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: '' },
  })

  // Ensure commander version satisfies OpenClaw expectations
  try {
    const openclawPkg = await readJson<{ dependencies?: Record<string, string> }>(
      join(TMP_DIR, 'node_modules', 'openclaw', 'package.json'),
    )
    const commanderRange = openclawPkg.dependencies?.commander
    const expectedMajor = parseMajor(commanderRange)
    const commanderPkgPath = join(TMP_DIR, 'node_modules', 'commander', 'package.json')
    const commanderPkg = await readJson<{ version?: string }>(commanderPkgPath)
    const installedMajor = parseMajor(commanderPkg.version)
    if (expectedMajor && installedMajor !== null && installedMajor < expectedMajor) {
      console.log(
        `  [fix] commander ${commanderPkg.version} < ${commanderRange} — reinstalling`,
      )
      execSync(`npm install --save commander@${commanderRange} --no-audit --no-fund`, {
        cwd: TMP_DIR,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: '' },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  [warn] commander check failed: ${msg.split('\n')[0]}`)
  }

  // Verify npm produced the expected files
  const pkgDir = join(TMP_DIR, 'node_modules', 'openclaw')
  if (!(await fileExists(join(pkgDir, 'openclaw.mjs')))) {
    throw new Error('openclaw.mjs not found in installed package')
  }

  const pkgJson = JSON.parse(
    await readFile(join(pkgDir, 'package.json'), 'utf8'),
  )
  const actualVersion: string = pkgJson.version
  console.log(`  [installed] openclaw v${actualVersion}`)

  // Copy package files (excluding nested node_modules) to build/openclaw/
  await mkdir(OPENCLAW_DIR, { recursive: true })
  console.log('  [extract] copying package files...')
  const pkgEntries = await readdir(pkgDir, { withFileTypes: true })
  for (const entry of pkgEntries) {
    if (entry.name === 'node_modules') continue
    await cp(join(pkgDir, entry.name), join(OPENCLAW_DIR, entry.name), {
      recursive: true,
    })
  }

  // Copy dependency tree to build/openclaw/node_modules/
  console.log('  [extract] copying dependencies (may be large)...')
  const nmSrc = join(TMP_DIR, 'node_modules')
  const nmDest = join(OPENCLAW_DIR, 'node_modules')
  await mkdir(nmDest, { recursive: true })

  const depEntries = await readdir(nmSrc, { withFileTypes: true })
  for (const dep of depEntries) {
    if (dep.name === 'openclaw' || dep.name === '.package-lock.json') continue
    await cp(join(nmSrc, dep.name), join(nmDest, dep.name), {
      recursive: true,
    })
  }

  // Version marker for idempotent re-runs
  await writeFile(markerPath, actualVersion + '\n', 'utf8')

  // Cleanup temp directory
  console.log('  [cleanup] removing temp directory...')
  await rm(TMP_DIR, { recursive: true, force: true })

  // Final verification with bundled node.exe
  console.log('  [verify] testing with bundled node.exe...')
  const openclawMjs = join(OPENCLAW_DIR, 'openclaw.mjs')
  try {
    const result = execSync(`"${NODE_EXE}" "${openclawMjs}" --version`, {
      encoding: 'utf8',
      timeout: 30_000,
    }).trim()
    console.log(`  [verify] openclaw --version → ${result}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  [warn] --version check returned non-zero (may be OK): ${msg.split('\n')[0]}`)
  }

  // Verify key directories exist
  const requiredPaths = ['openclaw.mjs', 'dist', 'node_modules']
  for (const p of requiredPaths) {
    if (!(await fileExists(join(OPENCLAW_DIR, p)))) {
      throw new Error(`Required path missing after install: ${p}`)
    }
  }
  const entryJs = join(OPENCLAW_DIR, 'dist', 'entry.js')
  const entryMjs = join(OPENCLAW_DIR, 'dist', 'entry.mjs')
  if (!(await fileExists(entryJs)) && !(await fileExists(entryMjs))) {
    throw new Error('Required OpenClaw build output missing: dist/entry.(m)js')
  }

  await ensureOpenClawControlUiBuilt(OPENCLAW_DIR, actualVersion)

  console.log(`\n  OK: OpenClaw ${actualVersion} ready at ${OPENCLAW_DIR}\n`)
}

main().catch((err) => {
  console.error(`\n  FAIL: download-openclaw: ${err.message || err}\n`)
  process.exit(1)
})
