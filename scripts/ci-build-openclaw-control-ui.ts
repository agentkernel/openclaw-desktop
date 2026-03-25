/**
 * CI only (Linux): build OpenClaw Control UI into build/_ci_openclaw_control_ui_root/dist/control-ui
 * for upload as a workflow artifact. Windows packaging merges this path to avoid Vite/Rolldown on win-latest.
 */

import { mkdir, rm, access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { downloadAndBuildOpenClawControlUiAt } from './ensure-openclaw-control-ui.ts'
import { verifyControlUiBundle } from './lib/control-ui-verify.ts'

const OUT_ROOT = join(process.cwd(), 'build', '_ci_openclaw_control_ui_root')

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function resolveOpenclawBundleVersion(): Promise<string> {
  const env = process.env.OPENCLAW_DESKTOP_BUNDLE_VERSION?.trim()
  if (env) return env
  try {
    const raw = await readFile(join(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { openclawBundleVersion?: string }
    const v = pkg.openclawBundleVersion?.trim()
    if (v) return v
  } catch {
    // ignore
  }
  console.warn(
    '  [warn] No openclawBundleVersion in package.json — using npm openclaw@latest (may diverge from Windows bundle job).',
  )
  return execSync('npm view openclaw version', { encoding: 'utf8' }).trim()
}

async function main(): Promise<void> {
  const version = await resolveOpenclawBundleVersion()

  console.log(`\nci-build-openclaw-control-ui: OpenClaw ${version}\n`)

  await rm(OUT_ROOT, { recursive: true, force: true })
  await mkdir(OUT_ROOT, { recursive: true })

  await downloadAndBuildOpenClawControlUiAt(OUT_ROOT, version)

  const controlUiRoot = join(OUT_ROOT, 'dist', 'control-ui')
  const indexHtml = join(controlUiRoot, 'index.html')
  if (!(await fileExists(indexHtml))) {
    throw new Error(`Expected ${indexHtml} after build`)
  }
  await verifyControlUiBundle(controlUiRoot)

  console.log(`\n  OK: Control UI at ${controlUiRoot}\n`)
}

main().catch((err) => {
  console.error(`\n  FAIL: ci-build-openclaw-control-ui: ${err.message || err}\n`)
  process.exit(1)
})
