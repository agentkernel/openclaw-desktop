#!/usr/bin/env node
/**
 * Export dev signing cert as base64 for GitHub Actions secrets.
 * Run `pnpm run generate-dev-cert` first.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const certPath = join(__dirname, '..', 'certs', 'openclaw-dev.pfx')

if (!existsSync(certPath)) {
  console.error('Error: certificate not found. Run pnpm run generate-dev-cert first.')
  process.exit(1)
}

const pfx = readFileSync(certPath)
const base64 = pfx.toString('base64').replace(/\n/g, '')

console.log('# Paste this base64 as GitHub Secret CSC_LINK (single line, no spaces):\n')
console.log(base64)
if (base64.length > 8192) {
  console.log('\n# Warning: base64 > 8192 chars may be truncated in Windows env vars; omit chain certs if possible.')
}
console.log('\n# CSC_KEY_PASSWORD value:')
console.log('openclaw-dev')
console.log('\n# Add both secrets under Settings → Secrets → Actions; Release workflow will use dev signing.')
