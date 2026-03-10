#!/usr/bin/env node
/**
 * Generate latest.yml or latest-beta.yml for electron-updater.
 * Used by CI release workflow; format compatible with electron-updater 2.15+.
 *
 * Usage:
 *   node scripts/generate-latest-yml.mjs --exe <path> --version <ver> --channel <stable|beta> [--output <dir>]
 *
 * Output: latest.yml (stable) or latest-beta.yml (beta)
 */

import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--exe' && args[i + 1]) {
      opts.exe = args[++i]
    } else if (args[i] === '--version' && args[i + 1]) {
      opts.version = args[++i]
    } else if (args[i] === '--channel' && args[i + 1]) {
      opts.channel = args[++i]
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[++i]
    } else if (args[i] === '--manifest' && args[i + 1]) {
      opts.manifest = args[++i]
    }
  }
  return opts
}

function sha512Base64(filePath) {
  const buf = readFileSync(filePath)
  return createHash('sha512').update(buf).digest('base64')
}

function readManifest(manifestPath) {
  try {
    const content = readFileSync(manifestPath, 'utf8')
    const m = JSON.parse(content)
    return {
      shellVersion: m.shellVersion || null,
      bundledOpenClawVersion: m.bundledOpenClawVersion || null,
    }
  } catch {
    return null
  }
}

function main() {
  const { exe, version, channel, output, manifest } = parseArgs()

  if (!exe || !version) {
    console.error('Usage: node generate-latest-yml.mjs --exe <path> --version <ver> --channel <stable|beta> [--output <dir>] [--manifest <path>]')
    process.exit(1)
  }

  const actualChannel = channel === 'beta' ? 'beta' : 'stable'
  const stat = statSync(exe)
  const sha512 = sha512Base64(exe)
  const filename = basename(exe)
  const releaseDate = new Date().toISOString()

  const manifestData = manifest ? readManifest(manifest) : null

  const yamlLines = [
    `version: ${version}`,
    `path: ${filename}`,
    `sha512: ${sha512}`,
    'files:',
    `  - url: ${filename}`,
    `    sha512: ${sha512}`,
    `    size: ${stat.size}`,
    `releaseDate: '${releaseDate}'`,
  ]
  if (manifestData?.shellVersion) {
    yamlLines.push(`shellVersion: ${manifestData.shellVersion}`)
  }
  if (manifestData?.bundledOpenClawVersion) {
    yamlLines.push(`bundledOpenClawVersion: ${manifestData.bundledOpenClawVersion}`)
  }
  const content = yamlLines.join('\n')

  const outFilename = actualChannel === 'beta' ? 'latest-beta.yml' : 'latest.yml'
  const outPath = output ? join(output, outFilename) : outFilename

  writeFileSync(outPath, content + '\n', 'utf8')
  console.log(`Wrote ${outPath}`)
}

main()
