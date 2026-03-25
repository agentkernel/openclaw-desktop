/**
 * Post electron-builder: verify win-unpacked is internally consistent (anti mixed-artifact blackscreen).
 * - app.asar/package.json version === repo package.json version
 * - resources/bundle-manifest.json shellVersion === repo version
 * - manifest bundledOpenClawVersion === resources/openclaw/package.json version
 * - control-ui/index.html script (and modulepreload) targets exist on disk
 */

import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { verifyControlUiBundle } from './lib/control-ui-verify.ts'

const require = createRequire(import.meta.url)
const { extractFile } = require('@electron/asar') as {
  extractFile: (archivePath: string, filename: string) => Buffer
}

const PROJECT_ROOT = process.cwd()
const DEFAULT_UNPACKED = join(PROJECT_ROOT, 'dist', 'win-unpacked')

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await readFile(p, 'utf8')) as T
}

async function main(): Promise<void> {
  const unpacked =
    process.env.VERIFY_PACKAGED_UNPACKED_DIR?.trim() || DEFAULT_UNPACKED

  console.log(`\nverify-packaged-win: ${unpacked}\n`)

  if (!(await exists(unpacked))) {
    throw new Error(
      `win-unpacked not found: ${unpacked}. Run electron-builder --win first.`,
    )
  }

  const rootPkg = await readJson<{ version?: string }>(
    join(PROJECT_ROOT, 'package.json'),
  )
  const expectedShell = rootPkg.version?.trim()
  if (!expectedShell) {
    throw new Error('package.json missing version')
  }

  const appAsar = join(unpacked, 'resources', 'app.asar')
  if (!(await exists(appAsar))) {
    throw new Error(`Missing ${appAsar}`)
  }

  let asarPkg: { version?: string }
  try {
    const raw = extractFile(appAsar, 'package.json').toString('utf8')
    asarPkg = JSON.parse(raw) as { version?: string }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read package.json from app.asar: ${msg}`)
  }
  const asarVersion = asarPkg.version?.trim()
  if (!asarVersion || asarVersion !== expectedShell) {
    throw new Error(
      `app.asar package.json version mismatch: expected ${expectedShell}, got ${asarVersion ?? '(missing)'}`,
    )
  }
  console.log(`  [ok] app.asar package.json version === ${expectedShell}`)

  const manifestPath = join(unpacked, 'resources', 'bundle-manifest.json')
  if (!(await exists(manifestPath))) {
    throw new Error(`Missing ${manifestPath}`)
  }
  const manifest = await readJson<{
    shellVersion?: string
    bundledOpenClawVersion?: string
  }>(manifestPath)
  const shellVersion = manifest.shellVersion?.trim()
  if (shellVersion !== expectedShell) {
    throw new Error(
      `bundle-manifest shellVersion mismatch: expected ${expectedShell}, got ${shellVersion ?? '(missing)'}`,
    )
  }
  console.log(`  [ok] bundle-manifest shellVersion === ${expectedShell}`)

  const openclawPkgPath = join(unpacked, 'resources', 'openclaw', 'package.json')
  if (!(await exists(openclawPkgPath))) {
    throw new Error(`Missing ${openclawPkgPath}`)
  }
  const openclawPkg = await readJson<{ version?: string }>(openclawPkgPath)
  const openclawVer = openclawPkg.version?.trim()
  const bundled = manifest.bundledOpenClawVersion?.trim()
  if (!bundled || !openclawVer || bundled !== openclawVer) {
    throw new Error(
      `OpenClaw version mismatch: bundle-manifest bundledOpenClawVersion=${bundled ?? '(missing)'}, resources/openclaw/package.json=${openclawVer ?? '(missing)'}`,
    )
  }
  console.log(`  [ok] bundled OpenClaw package version === manifest (${bundled})`)

  const markerPath = join(unpacked, 'resources', 'openclaw', '.openclaw-version')
  if (await exists(markerPath)) {
    const marker = (await readFile(markerPath, 'utf8')).trim()
    if (marker && marker !== openclawVer) {
      throw new Error(
        `.openclaw-version (${marker}) !== openclaw/package.json (${openclawVer})`,
      )
    }
    console.log('  [ok] .openclaw-version matches openclaw package.json')
  }

  const controlUiRoot = join(
    unpacked,
    'resources',
    'openclaw',
    'dist',
    'control-ui',
  )
  await verifyControlUiBundle(controlUiRoot)
  console.log('  [ok] control-ui bundle (refs + JS syntax)')

  console.log('\n  OK: packaged win-unpacked consistency check passed\n')
}

main().catch((err) => {
  console.error(`\n  FAIL: verify-packaged-win: ${err.message || err}\n`)
  process.exit(1)
})
