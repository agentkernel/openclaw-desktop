/**
 * Verify build/ resources are complete before packaging.
 * Ensures build/node/node.exe and build/openclaw/dist/entry.(m)js + chunks exist.
 * Verifies bundled openclaw CLI supports doctor/config/backup/plugins subcommands (DEPLOY-P55).
 */

import { access, mkdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { verifyControlUiBundle } from './lib/control-ui-verify.ts'

const PROJECT_ROOT = process.cwd()
const BUILD_DIR = join(PROJECT_ROOT, 'build')
const VERIFY_STATE_DIR = join(BUILD_DIR, '_verify_tmp')
const NODE_EXE = join(BUILD_DIR, 'node', 'node.exe')
const OPENCLAW_DIR = join(BUILD_DIR, 'openclaw')
const CLI_VERIFY_TIMEOUT_MS = Number(process.env.OPENCLAW_CLI_VERIFY_TIMEOUT_MS ?? 120_000)

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
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
  console.log('\nverify-bundle: checking build/ resources\n')

  if (!(await fileExists(NODE_EXE))) {
    throw new Error('build/node/node.exe not found. Run "pnpm run download-node" first.')
  }

  const openclawMjs = join(OPENCLAW_DIR, 'openclaw.mjs')
  if (!(await fileExists(openclawMjs))) {
    throw new Error('build/openclaw/openclaw.mjs not found. Run "pnpm run download-openclaw" first.')
  }
  if (!(await fileExists(join(OPENCLAW_DIR, 'node_modules')))) {
    throw new Error('build/openclaw/node_modules not found. Run "pnpm run download-openclaw" first.')
  }

  const missing = await validateOpenclawDist(OPENCLAW_DIR)
  if (missing.length > 0) {
    throw new Error(`OpenClaw dist missing: ${missing.join(', ')}`)
  }

  await verifyControlUiBundle(join(OPENCLAW_DIR, 'dist', 'control-ui'))
  console.log('  [ok] dist/control-ui (asset refs + JS syntax)')

  // DEPLOY-P55: verify bundled openclaw supports doctor/config/backup/plugins CLI
  const nodeUnix = join(BUILD_DIR, 'node', 'node')
  const nodeBin = (await fileExists(NODE_EXE)) ? NODE_EXE : nodeUnix
  if (!(await fileExists(nodeBin))) {
    throw new Error('build/node/node or node.exe not found.')
  }

  // Isolate verify env: avoid loading user config/plugins (which can cause ~2min+ hangs).
  await mkdir(VERIFY_STATE_DIR, { recursive: true })
  const verifyEnv = {
    ...process.env,
    OPENCLAW_STATE_DIR: VERIFY_STATE_DIR,
    OPENCLAW_CONFIG_PATH: join(VERIFY_STATE_DIR, 'openclaw.json'),
    OPENCLAW_HOME: VERIFY_STATE_DIR,
    OPENCLAW_TEST_FAST: '1',
  }

  const cliSubcommands = ['doctor', 'config', 'backup', 'plugins'] as const
  console.log('  [verify] checking OpenClaw CLI subcommands (doctor/config/backup/plugins)...')
  for (const sub of cliSubcommands) {
    const r = spawnSync(nodeBin, [openclawMjs, sub, '--help'], {
      encoding: 'utf8',
      timeout: CLI_VERIFY_TIMEOUT_MS,
      env: verifyEnv,
    })
    if (r.error && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      throw new Error(
        `OpenClaw CLI subcommand "${sub}" timed out after ${CLI_VERIFY_TIMEOUT_MS}ms. ` +
          'Increase OPENCLAW_CLI_VERIFY_TIMEOUT_MS and retry.',
      )
    }
    const out = ((r.stdout ?? '') + (r.stderr ?? '')).toLowerCase()
    const recognized =
      r.status === 0 ||
      out.includes('usage') ||
      out.includes(sub) ||
      (out.length > 20 && !out.includes('unknown command') && !out.includes('is not a'))
    if (!recognized) {
      throw new Error(
        `OpenClaw CLI subcommand "${sub}" not available. Run "pnpm run download-openclaw" to refresh bundle.`,
      )
    }
  }
  console.log('  [verify] CLI subcommands OK')

  // Desktop spawns: node openclaw.mjs gateway run --allow-unconfigured --bind loopback --port <n> [--token ... --auth token] [--force]
  console.log('  [verify] checking OpenClaw CLI "gateway run" (desktop launch path)...')
  const rGatewayRun = spawnSync(nodeBin, [openclawMjs, 'gateway', 'run', '--help'], {
    encoding: 'utf8',
    timeout: CLI_VERIFY_TIMEOUT_MS,
    env: verifyEnv,
  })
  if (rGatewayRun.error && (rGatewayRun.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
    throw new Error(
      `OpenClaw "gateway run --help" timed out after ${CLI_VERIFY_TIMEOUT_MS}ms. Increase OPENCLAW_CLI_VERIFY_TIMEOUT_MS and retry.`,
    )
  }
  const gwHelp = ((rGatewayRun.stdout ?? '') + (rGatewayRun.stderr ?? '')).toLowerCase()
  const gatewayRunOk =
    rGatewayRun.status === 0 ||
    (gwHelp.includes('--port') &&
      (gwHelp.includes('allow-unconfigured') || gwHelp.includes('unconfigured')) &&
      (gwHelp.includes('--bind') || gwHelp.includes('bind')))
  if (!gatewayRunOk) {
    throw new Error(
      'OpenClaw "gateway run" command missing or does not advertise expected flags. ' +
        'Refresh bundle: pnpm run download-openclaw',
    )
  }
  console.log('  [verify] gateway run OK')

  console.log('  OK: build/ resources are complete\n')
}

main().catch((err) => {
  console.error(`\n  FAIL: verify-bundle: ${err.message || err}\n`)
  process.exit(1)
})
