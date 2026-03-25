/**
 * OpenClaw + bundled Node version consistency and registry alignment:
 * - package.json `openclawBundleVersion` (pin) vs env override
 * - npm registry `openclaw@latest` (warn or --strict-latest / OPENCLAW_STRICT_NPM_LATEST=1; skip: OPENCLAW_SKIP_NPM_LATEST_CHECK=1 / --skip-npm-latest-check)
 * - build/node + resources/node `.node-version` vs bundled Node (sync with download-node.ts + CI NODE_VERSION_CI)
 * - resources/bundle-manifest.json (shellVersion + bundledOpenClawVersion)
 * - build/openclaw and resources/openclaw package.json / .openclaw-version when present
 *
 * Usage:
 *   pnpm exec tsx scripts/check-openclaw-versions.ts              # CI verify / local
 *   pnpm exec tsx scripts/check-openclaw-versions.ts --pre-pack  # before verify-bundle: allow stale manifest bundled until prepare-bundle
 *   pnpm exec tsx scripts/check-openclaw-versions.ts --align-latest
 *   pnpm exec tsx scripts/check-openclaw-versions.ts --sync-manifest
 *   OPENCLAW_SKIP_NPM_LATEST_CHECK=1 pnpm exec tsx scripts/check-openclaw-versions.ts  # pin-only (no npm latest)
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()
const PKG_PATH = join(PROJECT_ROOT, 'package.json')
const MANIFEST_PATH = join(PROJECT_ROOT, 'resources', 'bundle-manifest.json')
const BUILD_OPENCLAW_PKG = join(PROJECT_ROOT, 'build', 'openclaw', 'package.json')
const BUILD_MARKER = join(PROJECT_ROOT, 'build', 'openclaw', '.openclaw-version')
const RES_OPENCLAW_PKG = join(PROJECT_ROOT, 'resources', 'openclaw', 'package.json')
const RES_MARKER = join(PROJECT_ROOT, 'resources', 'openclaw', '.openclaw-version')
const BUILD_NODE_MARKER = join(PROJECT_ROOT, 'build', 'node', '.node-version')
const RES_NODE_MARKER = join(PROJECT_ROOT, 'resources', 'node', '.node-version')

/** Sync with scripts/download-node.ts DEFAULT_VERSION and .github/workflows/release.yml NODE_VERSION_CI */
const BUNDLED_NODE_VERSION = '22.16.0'
const EXPECTED_NODE_TAG = `v${BUNDLED_NODE_VERSION}`

async function fileExists(p: string): Promise<boolean> {
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

function npmOpenclawLatest(): string {
  return execSync('npm view openclaw version', { encoding: 'utf8' }).trim()
}

type RootPackage = {
  version?: string
  openclawBundleVersion?: string
}

type BundleManifest = {
  shellVersion?: string
  bundledOpenClawVersion?: string
}

function parseArgs(argv: string[]): {
  prePack: boolean
  alignLatest: boolean
  syncManifest: boolean
  strictLatest: boolean
  skipNpmLatestCheck: boolean
} {
  return {
    prePack: argv.includes('--pre-pack'),
    alignLatest: argv.includes('--align-latest'),
    syncManifest: argv.includes('--sync-manifest'),
    strictLatest:
      argv.includes('--strict-latest') || process.env.OPENCLAW_STRICT_NPM_LATEST === '1',
    skipNpmLatestCheck:
      argv.includes('--skip-npm-latest-check') ||
      process.env.OPENCLAW_SKIP_NPM_LATEST_CHECK === '1',
  }
}

async function resolveExpectedPin(): Promise<{
  expected: string
  fromPackage: string | null
  fromEnv: string | null
  warnings: string[]
}> {
  const warnings: string[] = []
  const pkg = await readJson<RootPackage>(PKG_PATH)
  const fromPackage = pkg.openclawBundleVersion?.trim() || null
  const fromEnv = process.env.OPENCLAW_DESKTOP_BUNDLE_VERSION?.trim() || null

  if (fromEnv && fromPackage && fromEnv !== fromPackage) {
    throw new Error(
      `OPENCLAW_DESKTOP_BUNDLE_VERSION (${fromEnv}) disagrees with package.json openclawBundleVersion (${fromPackage}). ` +
        'Unset the env var or bump the pin so release and local builds stay aligned.',
    )
  }

  if (fromEnv) {
    return { expected: fromEnv.replace(/^v/, ''), fromPackage, fromEnv, warnings }
  }
  if (fromPackage) {
    return { expected: fromPackage.replace(/^v/, ''), fromPackage, fromEnv, warnings }
  }

  const latest = npmOpenclawLatest()
  warnings.push(
    'No openclawBundleVersion in package.json — using npm openclaw@latest as expected version. Pin openclawBundleVersion to avoid drift.',
  )
  return { expected: latest, fromPackage, fromEnv, warnings }
}

async function checkNodeVersionMarkers(
  prePack: boolean,
  errors: string[],
  okLines: string[],
): Promise<void> {
  const checkOne = async (label: string, markerPath: string, mustExist: boolean): Promise<void> => {
    if (!(await fileExists(markerPath))) {
      if (mustExist) {
        errors.push(`${label}: missing .node-version — expected ${EXPECTED_NODE_TAG}`)
      }
      return
    }
    const raw = (await readFile(markerPath, 'utf8')).trim()
    if (raw !== EXPECTED_NODE_TAG) {
      errors.push(
        `${label}: expected Node marker ${EXPECTED_NODE_TAG}, got ${raw || '(empty)'} — re-run download-node / prepare-bundle`,
      )
    } else {
      okLines.push(`  [ok] ${label} → ${raw} (bundled ${BUNDLED_NODE_VERSION})`)
    }
  }

  if (prePack) {
    await checkOne('build/node', BUILD_NODE_MARKER, true)
  } else {
    await checkOne('build/node', BUILD_NODE_MARKER, false)
    await checkOne('resources/node', RES_NODE_MARKER, false)
    if (!(await fileExists(BUILD_NODE_MARKER)) && !(await fileExists(RES_NODE_MARKER))) {
      console.log(
        '  [skip] no Node bundle markers under build/ or resources/ (run download-node / prepare-bundle before packaging)',
      )
    }
  }
}

async function readOpenclawDirVersion(pkgPath: string, markerPath: string): Promise<string | null> {
  let v: string | null = null
  if (await fileExists(pkgPath)) {
    try {
      const p = await readJson<{ version?: string }>(pkgPath)
      v = p.version?.trim() || null
    } catch {
      /* ignore */
    }
  }
  if (await fileExists(markerPath)) {
    const m = (await readFile(markerPath, 'utf8')).trim()
    if (m && v && m !== v) {
      throw new Error(`Version mismatch: ${pkgPath} says ${v} but ${markerPath} says ${m}`)
    }
    if (m) v = m
  }
  return v
}

async function alignLatest(): Promise<void> {
  const latest = npmOpenclawLatest()
  const pkgRaw = await readFile(PKG_PATH, 'utf8')
  const pkg = JSON.parse(pkgRaw) as RootPackage
  const shellVersion = pkg.version?.trim() || '0.0.0'

  let nextRaw: string
  if (/"openclawBundleVersion"\s*:/.test(pkgRaw)) {
    nextRaw = pkgRaw.replace(
      /("openclawBundleVersion"\s*:\s*")[^"]*(")/,
      `$1${latest}$2`,
    )
  } else {
    nextRaw = pkgRaw.replace(
      /(\{\s*\n\s*"name"\s*:)/,
      `{\n  "openclawBundleVersion": "${latest}",\n  "name":`,
    )
    if (nextRaw === pkgRaw) {
      nextRaw =
        pkgRaw.replace(/^\{\s*\n/, `{\n  "openclawBundleVersion": "${latest}",\n`)
    }
  }
  await writeFile(PKG_PATH, nextRaw, 'utf8')
  console.log(`  [align] package.json openclawBundleVersion → ${latest}`)

  await mkdir(join(PROJECT_ROOT, 'resources'), { recursive: true })
  await writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        shellVersion,
        bundledOpenClawVersion: latest,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  console.log(`  [align] resources/bundle-manifest.json → shell ${shellVersion} · OpenClaw ${latest}`)
  console.log('\n  Next: pnpm run download-openclaw && pnpm run prepare-bundle (or full package:prepare-deps + package:win)\n')
}

async function syncManifestFromPin(expected: string, shellVersion: string): Promise<void> {
  await mkdir(join(PROJECT_ROOT, 'resources'), { recursive: true })
  await writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        shellVersion,
        bundledOpenClawVersion: expected,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  console.log(`  [sync] resources/bundle-manifest.json → shell ${shellVersion} · OpenClaw ${expected}\n`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.alignLatest && args.syncManifest) {
    throw new Error('Use only one of --align-latest or --sync-manifest')
  }

  if (args.alignLatest) {
    console.log('\ncheck-openclaw-versions: --align-latest (npm openclaw@latest)\n')
    await alignLatest()
    return
  }

  const pkg = await readJson<RootPackage>(PKG_PATH)
  const shellVersion = pkg.version?.trim() || '0.0.0'
  const { expected, warnings } = await resolveExpectedPin()
  for (const w of warnings) console.warn(`  [warn] ${w}`)

  if (args.syncManifest) {
    console.log('\ncheck-openclaw-versions: --sync-manifest from pin\n')
    if (!(await fileExists(join(PROJECT_ROOT, 'resources')))) {
      throw new Error('resources/ directory missing')
    }
    await syncManifestFromPin(expected, shellVersion)
    return
  }

  console.log(`\ncheck-openclaw-versions: expected OpenClaw ${expected}${args.prePack ? ' (--pre-pack)' : ''}\n`)

  const errors: string[] = []
  const okLines: string[] = []

  if (args.skipNpmLatestCheck) {
    console.log(
      '  [skip] npm openclaw@latest check (OPENCLAW_SKIP_NPM_LATEST_CHECK=1 or --skip-npm-latest-check)',
    )
  } else {
    try {
      const npmLatest = npmOpenclawLatest()
      console.log(`  [registry] npm openclaw@latest → ${npmLatest}`)
      if (expected !== npmLatest) {
        const msg =
          `Pinned OpenClaw (${expected}) differs from npm openclaw@latest (${npmLatest}). ` +
          'GitHub / release builds may not match what users get from npm install openclaw@latest; bump openclawBundleVersion or run --align-latest.'
        if (args.strictLatest) {
          errors.push(msg)
        } else {
          console.warn(`  [warn] ${msg}`)
        }
      } else {
        console.log('  [ok] openclaw bundle pin matches npm openclaw@latest')
      }
    } catch (e) {
      const mes = e instanceof Error ? e.message : String(e)
      console.warn(`  [warn] could not query npm for openclaw@latest: ${mes}`)
    }
  }

  await checkNodeVersionMarkers(args.prePack, errors, okLines)

  const buildVer = await readOpenclawDirVersion(BUILD_OPENCLAW_PKG, BUILD_MARKER)
  if (buildVer === null) {
    if (args.prePack) {
      errors.push('build/openclaw not found or unreadable — run pnpm run download-openclaw')
    } else {
      console.log('  [skip] build/openclaw not present (run download-openclaw before packaging)')
    }
  } else if (buildVer !== expected) {
    errors.push(`build/openclaw version ${buildVer} !== expected ${expected}`)
  } else {
    okLines.push(`  [ok] build/openclaw → ${buildVer}`)
  }

  const hasResOpenclawTree = await fileExists(join(PROJECT_ROOT, 'resources', 'openclaw', 'openclaw.mjs'))
  const resVer = hasResOpenclawTree ? await readOpenclawDirVersion(RES_OPENCLAW_PKG, RES_MARKER) : null
  if (resVer !== null && resVer !== expected) {
    errors.push(`resources/openclaw version ${resVer} !== expected ${expected}`)
  } else if (resVer !== null) {
    okLines.push(`  [ok] resources/openclaw → ${resVer}`)
  }

  const manifestExists = await fileExists(MANIFEST_PATH)
  if (manifestExists) {
    const manifest = await readJson<BundleManifest>(MANIFEST_PATH)
    const shell = manifest.shellVersion?.trim()
    const bundled = manifest.bundledOpenClawVersion?.trim()

    if (shell && shell !== shellVersion) {
      errors.push(`bundle-manifest shellVersion ${shell} !== package.json version ${shellVersion}`)
    } else if (shell) {
      okLines.push(`  [ok] bundle-manifest shellVersion → ${shell}`)
    }

    const requireBundled = !args.prePack || hasResOpenclawTree

    if (requireBundled) {
      if (!bundled || bundled !== expected) {
        errors.push(
          `bundle-manifest bundledOpenClawVersion ${bundled ?? '(missing)'} !== expected ${expected}`,
        )
      } else {
        okLines.push(`  [ok] bundle-manifest bundledOpenClawVersion → ${bundled}`)
      }
    } else {
      if (bundled && bundled !== expected) {
        console.warn(
          `  [warn] bundle-manifest bundledOpenClawVersion ${bundled} !== ${expected} — will be rewritten by prepare-bundle`,
        )
      }
    }
  } else {
    errors.push('resources/bundle-manifest.json missing')
  }

  if (errors.length > 0) {
    console.error('  Mismatches:')
    for (const e of errors) console.error(`    - ${e}`)
    console.error(
      '\n  Fix: sync manifest: --sync-manifest; align pin to npm latest: --align-latest; ' +
        'require pin === npm latest: OPENCLAW_STRICT_NPM_LATEST=1 or --strict-latest; ' +
        'skip npm latest compare in CI: OPENCLAW_SKIP_NPM_LATEST_CHECK=1. ' +
        'Then: pnpm run download-openclaw && pnpm run prepare-bundle (and download-node if Node markers fail).\n',
    )
    throw new Error('OpenClaw version consistency check failed')
  }

  for (const line of okLines) console.log(line)
  console.log('\n  OK: OpenClaw version pins and on-disk refs are aligned\n')
}

main().catch((err) => {
  console.error(`\n  FAIL: check-openclaw-versions: ${err instanceof Error ? err.message : err}\n`)
  process.exit(1)
})
