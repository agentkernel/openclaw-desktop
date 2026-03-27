/**
 * Prepare bundle resources for electron-builder extraResources.
 * Copies build/node/ → resources/node/ and build/openclaw/ → resources/openclaw/
 * Usage: pnpm run prepare-bundle
 */

import { cp, rm, readFile, writeFile, access, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { patchOpenClawFeishuRegisterOnce } from './patch-openclaw-feishu-register-once.ts'

const PROJECT_ROOT = process.cwd()
const BUILD_DIR = join(PROJECT_ROOT, 'build')
const RESOURCES_DIR = join(PROJECT_ROOT, 'resources')

const SRC_NODE = join(BUILD_DIR, 'node')
const SRC_OPENCLAW = join(BUILD_DIR, 'openclaw')
const DEST_NODE = join(RESOURCES_DIR, 'node')
const DEST_OPENCLAW = join(RESOURCES_DIR, 'openclaw')

const NODE_VERSION_MARKER = '.node-version'
const OPENCLAW_VERSION_MARKER = '.openclaw-version'

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function readMarker(dir: string, marker: string): Promise<string | null> {
  const p = join(dir, marker)
  if (!(await fileExists(p))) return null
  return (await readFile(p, 'utf8')).trim()
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

async function commanderMajor(dir: string): Promise<number | null> {
  try {
    const pkg = await readJson<{ version?: string }>(
      join(dir, 'node_modules', 'commander', 'package.json'),
    )
    return parseMajor(pkg.version)
  } catch {
    return null
  }
}

async function expectedCommanderMajor(dir: string): Promise<number | null> {
  try {
    const pkg = await readJson<{ dependencies?: Record<string, string> }>(
      join(dir, 'package.json'),
    )
    return parseMajor(pkg.dependencies?.commander)
  } catch {
    return null
  }
}

async function copyDir(
  src: string,
  dest: string,
  label: string,
  versionMarker: string,
  requiredPaths: Array<string | string[]> = [],
  force = false,
): Promise<string> {
  const srcVersion = await readMarker(src, versionMarker)
  const destVersion = await readMarker(dest, versionMarker)

  if (!force && srcVersion && destVersion && srcVersion === destVersion) {
    if (requiredPaths.length > 0) {
      const missing: string[] = []
      for (const rel of requiredPaths) {
        if (Array.isArray(rel)) {
          let ok = false
          for (const candidate of rel) {
            if (await fileExists(join(dest, candidate))) {
              ok = true
              break
            }
          }
          if (!ok) {
            missing.push(rel.join(' or '))
          }
          continue
        }
        if (!(await fileExists(join(dest, rel)))) {
          missing.push(rel)
        }
      }
      if (missing.length === 0) {
        console.log(`  [skip] ${label}: version ${srcVersion} already in resources/`)
        return srcVersion
      }
      console.log(
        `  [warn] ${label}: version ${srcVersion} present but missing ${missing.join(', ')} — re-copying`,
      )
    } else {
      console.log(`  [skip] ${label}: version ${srcVersion} already in resources/`)
      return srcVersion
    }
  }

  if (await fileExists(dest)) {
    console.log(`  [clean] removing old ${label} resources...`)
    try {
      await rm(dest, { recursive: true, force: true })
    } catch {
      const { execSync } = await import('node:child_process')
      const winPath = dest.replace(/\//g, '\\')
      const longPath = winPath.startsWith('\\\\?\\') ? winPath : `\\\\?\\${winPath}`
      execSync(`cmd /c rmdir /s /q "${longPath}"`, { stdio: 'pipe' })
    }
  }

  console.log(`  [copy] ${label} → resources/${label}/...`)
  await cp(src, dest, { recursive: true })

  return srcVersion ?? 'unknown'
}

async function validateOpenclawDist(rootDir: string): Promise<string[]> {
  const entryPath = join(rootDir, 'dist', 'entry.js')
  const entryAlt = join(rootDir, 'dist', 'entry.mjs')
  const entryExists = (await fileExists(entryPath)) || (await fileExists(entryAlt))
  if (!entryExists) {
    return ['dist/entry.(m)js']
  }

  const entryContent = await readFile((await fileExists(entryPath)) ? entryPath : entryAlt, 'utf8')
  const importRegex = /\bimport\s+(?:[^'"]+from\s+)?['"](\.\/[^'"]+)['"]/g
  const missing: string[] = []
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(entryContent))) {
    const rel = match[1]
    if (!rel.startsWith('./')) continue
    const target = join(rootDir, 'dist', rel.replace(/^\.\//, ''))
    if (!(await fileExists(target))) {
      missing.push(`dist/${rel.replace(/^\.\//, '')}`)
    }
  }
  return missing
}

async function main(): Promise<void> {
  console.log('\nprepare-bundle: assemble resources for electron-builder\n')

  // --- Prerequisite checks ---
  const nodeExe = join(SRC_NODE, 'node.exe')
  if (!(await fileExists(nodeExe))) {
    throw new Error(
      'build/node/node.exe not found. Run "pnpm run download-node" on the build machine before packaging.',
    )
  }
  console.log('  [ok] build/node/node.exe found')

  const openclawMjs = join(SRC_OPENCLAW, 'openclaw.mjs')
  if (!(await fileExists(openclawMjs))) {
    throw new Error(
      'build/openclaw/openclaw.mjs not found. Run "pnpm run download-openclaw" on the build machine before packaging.',
    )
  }
  console.log('  [ok] build/openclaw/openclaw.mjs found')
  if (!(await fileExists(join(SRC_OPENCLAW, 'node_modules')))) {
    throw new Error(
      'build/openclaw/node_modules not found. Run "pnpm run download-openclaw" on the build machine before packaging.',
    )
  }
  console.log('  [ok] build/openclaw/node_modules found')

  await patchOpenClawFeishuRegisterOnce(SRC_OPENCLAW)

  // --- Ensure resources directory exists ---
  await mkdir(RESOURCES_DIR, { recursive: true })

  // --- Copy app icon (apple-touch-icon.png) to resources if present ---
  const appleTouchIcon = join(PROJECT_ROOT, 'apple-touch-icon.png')
  if (await fileExists(appleTouchIcon)) {
    await cp(appleTouchIcon, join(RESOURCES_DIR, 'apple-touch-icon.png'))
    console.log('  [copy] apple-touch-icon.png → resources/')
  }

  // --- Copy Node.js ---
  const nodeVersion = await copyDir(SRC_NODE, DEST_NODE, 'node', NODE_VERSION_MARKER, ['node.exe'])

  // --- Copy OpenClaw ---
  const expectedCommander = await expectedCommanderMajor(SRC_OPENCLAW)
  const destCommander = await commanderMajor(DEST_OPENCLAW)
  const forceOpenclawCopy =
    expectedCommander !== null && destCommander !== null && destCommander < expectedCommander
  if (forceOpenclawCopy) {
    console.log(
      `  [warn] openclaw: commander v${destCommander} < v${expectedCommander} — re-copying`,
    )
  }
  const openclawVersion = await copyDir(
    SRC_OPENCLAW,
    DEST_OPENCLAW,
    'openclaw',
    OPENCLAW_VERSION_MARKER,
    [
      'openclaw.mjs',
      ['dist/entry.js', 'dist/entry.mjs'],
      join('dist', 'control-ui', 'index.html'),
      'node_modules',
    ],
    forceOpenclawCopy,
  )

  // --- Validate OpenClaw dist integrity ---
  const missingDist = await validateOpenclawDist(DEST_OPENCLAW)
  if (missingDist.length > 0) {
    throw new Error(`OpenClaw dist missing in resources: ${missingDist.join(', ')}`)
  }

  // --- Post-copy verification ---
  console.log('  [verify] checking resource structure...')
  const required = [
    join(DEST_NODE, 'node.exe'),
    join(DEST_OPENCLAW, 'openclaw.mjs'),
    join(DEST_OPENCLAW, 'dist'),
    join(DEST_OPENCLAW, 'dist', 'control-ui', 'index.html'),
    join(DEST_OPENCLAW, 'node_modules'),
  ]
  for (const p of required) {
    if (!(await fileExists(p))) {
      throw new Error(`Required resource missing after copy: ${p}`)
    }
  }
  console.log('  [verify] structure OK')

  const controlUiRoot = join(DEST_OPENCLAW, 'dist', 'control-ui')
  if (await fileExists(controlUiRoot)) {
    const { transpileControlUiForElectronEmbedded } = await import(
      './lib/transpile-control-ui-for-electron.ts'
    )
    console.log('  [control-ui] lowering JS for embedded Chromium (desktop post-process)...')
    await transpileControlUiForElectronEmbedded(controlUiRoot)
  }

  // --- Runtime verification ---
  console.log('  [verify] testing openclaw with bundled node...')
  const destNodeExe = join(DEST_NODE, 'node.exe')
  const destOpenclawMjs = join(DEST_OPENCLAW, 'openclaw.mjs')
  try {
    const result = execSync(`"${destNodeExe}" "${destOpenclawMjs}" --version`, {
      encoding: 'utf8',
      timeout: 30_000,
    }).trim()
    console.log(`  [verify] openclaw --version → ${result}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(
      `  [warn] --version check returned non-zero (may be OK): ${msg.split('\n')[0]}`,
    )
  }

  // --- Write bundle manifest (shellVersion + bundledOpenClawVersion) ---
  const pkg = await readJson<{ version?: string }>(join(PROJECT_ROOT, 'package.json'))
  const shellVersion = pkg.version ?? '0.0.0'
  const manifest = {
    shellVersion,
    bundledOpenClawVersion: openclawVersion,
  }
  const manifestPath = join(RESOURCES_DIR, 'bundle-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`  [manifest] bundle-manifest.json: Shell v${shellVersion} · OpenClaw v${openclawVersion}`)

  // --- Summary ---
  console.log(`\n  OK: Bundle resources ready`)
  console.log(`      Node.js:   ${nodeVersion} → resources/node/`)
  console.log(`      OpenClaw:  ${openclawVersion} → resources/openclaw/\n`)
}

main().catch((err) => {
  console.error(`\n  FAIL: prepare-bundle: ${err.message || err}\n`)
  process.exit(1)
})
