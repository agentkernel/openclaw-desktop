/**
 * Download portable Node.js (Windows x64) to build/node/
 * Usage: pnpm run download-node [-- <version>]
 * Default: 22.16.0
 */

import { createWriteStream } from 'node:fs'
import { mkdir, rm, readFile, access, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import AdmZip from 'adm-zip'

/** Keep in sync with scripts/check-openclaw-versions.ts BUNDLED_NODE_VERSION and release.yml NODE_VERSION_CI */
const DEFAULT_VERSION = '22.16.0'
const NODE_DIST_URL = 'https://nodejs.org/dist'
const BUILD_DIR = join(process.cwd(), 'build')
const NODE_DIR = join(BUILD_DIR, 'node')

async function downloadToFile(url: string, dest: string): Promise<void> {
  console.log(`  > GET ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} from ${url}`)
  if (!res.body) throw new Error(`Empty response body from ${url}`)
  const ws = createWriteStream(dest)
  await pipeline(Readable.fromWeb(res.body as ReadableStream), ws)
}

async function computeSha256(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

function parseShasum(shasumsText: string, filename: string): string {
  for (const line of shasumsText.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.endsWith(filename)) {
      const hash = trimmed.split(/\s+/)[0]
      if (hash && /^[a-f0-9]{64}$/i.test(hash)) return hash
    }
  }
  throw new Error(`SHA-256 hash not found for "${filename}" in SHASUMS256.txt`)
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const version = (process.argv[2] || DEFAULT_VERSION).replace(/^v/, '')
  const vTag = `v${version}`
  const zipName = `node-${vTag}-win-x64.zip`
  const innerDir = `node-${vTag}-win-x64`

  console.log(`\ndownload-node: Node.js ${vTag} (Windows x64)\n`)

  const nodeExe = join(NODE_DIR, 'node.exe')
  if (await fileExists(nodeExe)) {
    try {
      const existing = execSync(`"${nodeExe}" --version`, {
        encoding: 'utf8',
      }).trim()
      if (existing === vTag) {
        console.log(`  [skip] Node.js ${vTag} already present at ${NODE_DIR}`)
        return
      }
      console.log(
        `  [info] Found ${existing}, need ${vTag} — re-downloading`,
      )
    } catch {
      console.log('  [info] Existing node.exe is invalid — re-downloading')
    }
    await rm(NODE_DIR, { recursive: true, force: true })
  }

  await mkdir(BUILD_DIR, { recursive: true })
  await mkdir(NODE_DIR, { recursive: true })

  // Fetch SHASUMS256.txt
  const shaUrl = `${NODE_DIST_URL}/${vTag}/SHASUMS256.txt`
  console.log(`  > GET ${shaUrl}`)
  const shaRes = await fetch(shaUrl)
  if (!shaRes.ok)
    throw new Error(`Failed to fetch checksums: HTTP ${shaRes.status}`)
  const shasums = await shaRes.text()
  const expectedHash = parseShasum(shasums, zipName)
  console.log(`  [sha256] expected ${expectedHash.slice(0, 16)}...`)

  // Download zip
  const zipPath = join(BUILD_DIR, zipName)
  await downloadToFile(`${NODE_DIST_URL}/${vTag}/${zipName}`, zipPath)
  console.log(`  [done] saved to ${zipPath}`)

  // Verify SHA-256
  console.log('  [verify] computing SHA-256...')
  const actualHash = await computeSha256(zipPath)
  if (actualHash !== expectedHash) {
    await rm(zipPath, { force: true })
    throw new Error(
      `SHA-256 mismatch!\n  expected: ${expectedHash}\n  actual:   ${actualHash}`,
    )
  }
  console.log('  [verify] SHA-256 OK')

  // Extract node.exe from zip
  console.log('  [extract] extracting node.exe...')
  const zip = new AdmZip(zipPath)
  const entryPath = `${innerDir}/node.exe`
  const entry = zip.getEntry(entryPath)
  if (!entry) {
    const entries = zip
      .getEntries()
      .map((e) => e.entryName)
      .slice(0, 10)
    throw new Error(
      `"${entryPath}" not found in zip. First entries: ${entries.join(', ')}`,
    )
  }
  zip.extractEntryTo(entry, NODE_DIR, false, true)

  // Version marker for idempotency
  await writeFile(join(NODE_DIR, '.node-version'), vTag + '\n', 'utf8')

  // Cleanup
  await rm(zipPath, { force: true })
  console.log('  [cleanup] removed zip archive')

  // Final verification
  const result = execSync(`"${nodeExe}" --version`, {
    encoding: 'utf8',
  }).trim()
  if (result !== vTag) {
    throw new Error(
      `Version mismatch after extraction: got ${result}, expected ${vTag}`,
    )
  }
  console.log(`\n  OK: Node.js ${result} ready at ${NODE_DIR}\n`)
}

main().catch((err) => {
  console.error(`\n  FAIL: download-node: ${err.message || err}\n`)
  process.exit(1)
})
