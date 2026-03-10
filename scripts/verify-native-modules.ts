/**
 * Verify native modules bundled in resources/openclaw/ are ABI-compatible
 * with the bundled Node.js in resources/node/.
 * Checks: sharp, sqlite-vec, @lydell/node-pty, koffi
 * Usage: pnpm run verify-native-modules
 */

import { access, writeFile, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const PROJECT_ROOT = process.cwd()
const RESOURCES_DIR = join(PROJECT_ROOT, 'resources')
const NODE_EXE = join(RESOURCES_DIR, 'node', 'node.exe')
const OPENCLAW_DIR = join(RESOURCES_DIR, 'openclaw')
const NODE_MODULES = join(OPENCLAW_DIR, 'node_modules')
const TEMP_SCRIPT = join(OPENCLAW_DIR, '_verify_native.cjs')

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

interface NativeModuleSpec {
  name: string
  description: string
  testScript: string
  fixHint: string
}

const NATIVE_MODULES: NativeModuleSpec[] = [
  {
    name: 'sharp',
    description: 'Image processing (sharp-libvips prebuilt)',
    testScript: [
      'try {',
      "  const sharp = require('sharp');",
      '  const v = sharp.versions || {};',
      "  const info = 'sharp=' + (v.sharp || '?') + ' libvips=' + (v.vips || '?');",
      '  console.log(JSON.stringify({ ok: true, info: info }));',
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, error: e.message }));',
      '}',
    ].join('\n'),
    fixHint:
      'Ensure @img/sharp-win32-x64 prebuilt is present. Try: npm install @img/sharp-win32-x64',
  },
  {
    name: 'sqlite-vec',
    description: 'SQLite vector extension (Windows prebuilt)',
    testScript: [
      'try {',
      "  const sv = require('sqlite-vec');",
      "  let info = 'loaded';",
      "  if (typeof sv.getLoadablePath === 'function') {",
      '    const p = sv.getLoadablePath();',
      "    const fs = require('fs');",
      '    if (!fs.existsSync(p)) {',
      "      console.log(JSON.stringify({ ok: false, error: 'Extension binary not found: ' + p }));",
      '      process.exit(0);',
      '    }',
      "    info = 'extension at ' + require('path').basename(p);",
      '  }',
      '  console.log(JSON.stringify({ ok: true, info: info }));',
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, error: e.message }));',
      '}',
    ].join('\n'),
    fixHint:
      'sqlite-vec Windows prebuilt may not be available. See https://github.com/asg017/sqlite-vec',
  },
  {
    name: '@lydell/node-pty',
    description: 'Terminal PTY bindings (Windows conpty)',
    testScript: [
      'try {',
      "  const pty = require('@lydell/node-pty');",
      "  console.log(JSON.stringify({ ok: true, info: 'conpty bindings loaded' }));",
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, error: e.message }));',
      '}',
    ].join('\n'),
    fixHint:
      'Ensure @lydell/node-pty has Windows conpty prebuilt matching the bundled Node.js ABI.',
  },
  {
    name: 'koffi',
    description: 'FFI bindings',
    testScript: [
      'try {',
      "  const koffi = require('koffi');",
      "  const info = 'version=' + (koffi.version || '?');",
      '  console.log(JSON.stringify({ ok: true, info: info }));',
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, error: e.message }));',
      '}',
    ].join('\n'),
    fixHint:
      'Ensure koffi has prebuilt binaries for win32-x64 and the target Node.js ABI version.',
  },
]

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'missing'
  message: string
  fixHint?: string
}

async function checkModuleExists(name: string): Promise<boolean> {
  const dir = name.startsWith('@')
    ? join(NODE_MODULES, ...name.split('/'))
    : join(NODE_MODULES, name)
  return fileExists(dir)
}

async function findNativeFiles(modDir: string): Promise<string[]> {
  const natives: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory() && e.name !== '.git') {
        await walk(full)
      } else if (e.name.endsWith('.node') || e.name.endsWith('.dll')) {
        natives.push(full.replace(NODE_MODULES + '\\', '').replace(NODE_MODULES + '/', ''))
      }
    }
  }
  await walk(modDir)
  return natives
}

async function runModuleCheck(spec: NativeModuleSpec): Promise<CheckResult> {
  await writeFile(TEMP_SCRIPT, spec.testScript, 'utf8')
  try {
    const stdout = execSync(`"${NODE_EXE}" "${TEMP_SCRIPT}"`, {
      cwd: OPENCLAW_DIR,
      encoding: 'utf8',
      timeout: 30_000,
    }).trim()

    try {
      const parsed = JSON.parse(stdout)
      if (parsed.ok) {
        return {
          name: spec.name,
          status: 'pass',
          message: parsed.info || 'loaded successfully',
        }
      }
      return {
        name: spec.name,
        status: 'fail',
        message: parsed.error || 'unknown error',
        fixHint: spec.fixHint,
      }
    } catch {
      return {
        name: spec.name,
        status: 'pass',
        message: stdout || 'loaded (no structured output)',
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const lines = msg.split('\n')
    const reason =
      lines.find((l) => l.includes('Error:') && !l.includes('execSync')) ||
      lines[0]
    return {
      name: spec.name,
      status: 'fail',
      message: reason?.trim() || 'load failed (process crashed)',
      fixHint: spec.fixHint,
    }
  }
}

async function main(): Promise<void> {
  console.log('\nverify-native-modules: checking ABI compatibility\n')

  if (!(await fileExists(NODE_EXE))) {
    throw new Error(
      'resources/node/node.exe not found. Run "pnpm run prepare-bundle" first.',
    )
  }

  if (!(await fileExists(join(OPENCLAW_DIR, 'openclaw.mjs')))) {
    throw new Error(
      'resources/openclaw/openclaw.mjs not found. Run "pnpm run prepare-bundle" first.',
    )
  }

  const nodeVersion = execSync(`"${NODE_EXE}" --version`, {
    encoding: 'utf8',
  }).trim()
  const nodeAbi = execSync(
    `"${NODE_EXE}" -e "process.stdout.write(process.versions.modules)"`,
    { encoding: 'utf8' },
  ).trim()
  console.log(`  [info] Bundled Node.js: ${nodeVersion} (ABI ${nodeAbi})`)
  console.log(`  [info] Platform: win32-x64\n`)

  const results: CheckResult[] = []

  for (const spec of NATIVE_MODULES) {
    const exists = await checkModuleExists(spec.name)
    if (!exists) {
      console.log(
        `  [skip] ${spec.name}: not in node_modules (${spec.description})`,
      )
      results.push({
        name: spec.name,
        status: 'missing',
        message: 'not found in node_modules',
      })
      continue
    }

    const modDir = spec.name.startsWith('@')
      ? join(NODE_MODULES, ...spec.name.split('/'))
      : join(NODE_MODULES, spec.name)
    const natives = await findNativeFiles(modDir)
    if (natives.length > 0) {
      console.log(
        `  [info] ${spec.name}: found ${natives.length} native file(s): ${natives.slice(0, 3).join(', ')}${natives.length > 3 ? '...' : ''}`,
      )
    }

    console.log(`  [test] ${spec.name}: ${spec.description}...`)
    const result = await runModuleCheck(spec)
    results.push(result)

    if (result.status === 'pass') {
      console.log(`  [pass] ${spec.name}: ${result.message}`)
    } else {
      console.log(`  [FAIL] ${spec.name}: ${result.message}`)
      if (result.fixHint) {
        console.log(`         Fix: ${result.fixHint}`)
      }
    }
  }

  await rm(TEMP_SCRIPT, { force: true })

  const passed = results.filter((r) => r.status === 'pass')
  const failed = results.filter((r) => r.status === 'fail')
  const missing = results.filter((r) => r.status === 'missing')

  console.log(
    `\n  Summary: ${passed.length} passed, ${failed.length} failed, ${missing.length} not present`,
  )

  if (failed.length > 0) {
    console.log('\n  Failed modules:')
    for (const f of failed) {
      console.log(`    - ${f.name}: ${f.message}`)
      if (f.fixHint) console.log(`      Fix: ${f.fixHint}`)
    }
    console.log('')
    throw new Error(
      `${failed.length} native module(s) failed: ${failed.map((f) => f.name).join(', ')}`,
    )
  }

  console.log(
    `\n  OK: All present native modules compatible with Node.js ${nodeVersion}\n`,
  )
}

main().catch((err) => {
  console.error(`\n  FAIL: verify-native-modules: ${err.message || err}\n`)
  process.exit(1)
})
