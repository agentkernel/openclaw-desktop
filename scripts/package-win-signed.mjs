#!/usr/bin/env node
/**
 * Windows package with code signing.
 * - Requires CSC_LINK + CSC_KEY_PASSWORD (or WIN_* variants)
 * - Loads .env when present
 * - Runs package:win
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) {
      const key = m[1]
      const val = m[2].replace(/^["']|["']$/g, '').trim()
      if (val && !process.env[key]) process.env[key] = val
    }
  }
}

const hasCert = process.env.CSC_LINK || process.env.WIN_CSC_LINK
const hasPass = process.env.CSC_KEY_PASSWORD || process.env.WIN_CSC_KEY_PASSWORD

if (!hasCert || !hasPass) {
  console.error('Error: signed build requires certificate env vars')
  console.error('  Set CSC_LINK + CSC_KEY_PASSWORD (or WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD)')
  console.error('  Or copy .env.example to .env, fill values, and retry')
  process.exit(1)
}

console.log('Signing credentials detected; starting package...\n')
const r = spawnSync('pnpm', ['run', 'package:win'], { stdio: 'inherit', cwd: root, env: process.env })
process.exit(r.status ?? 1)
