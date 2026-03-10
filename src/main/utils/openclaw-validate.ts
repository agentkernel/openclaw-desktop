import fs from 'node:fs'
import path from 'node:path'

export interface OpenClawValidationResult {
  ok: boolean
  missing: string[]
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function readEntryPath(openclawDir: string): string | null {
  const entryJs = path.join(openclawDir, 'dist', 'entry.js')
  const entryMjs = path.join(openclawDir, 'dist', 'entry.mjs')
  if (fileExists(entryJs)) return entryJs
  if (fileExists(entryMjs)) return entryMjs
  return null
}

export function validateOpenclawResources(openclawDir: string): OpenClawValidationResult {
  const missing: string[] = []

  if (!fileExists(path.join(openclawDir, 'openclaw.mjs'))) {
    missing.push('openclaw.mjs')
  }
  if (!fileExists(path.join(openclawDir, 'node_modules'))) {
    missing.push('node_modules/')
  }

  const entryPath = readEntryPath(openclawDir)
  if (!entryPath) {
    missing.push('dist/entry.(m)js')
    return { ok: false, missing }
  }

  try {
    const entryContent = fs.readFileSync(entryPath, 'utf-8')
    const importRegex = /\bimport\s+(?:[^'"]+from\s+)?['"](\.\/[^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(entryContent))) {
      const rel = match[1]
      if (!rel.startsWith('./')) continue
      const target = path.join(openclawDir, 'dist', rel.replace(/^\.\//, ''))
      if (!fileExists(target)) {
        missing.push(`dist/${rel.replace(/^\.\//, '')}`)
      }
    }
  } catch {
    missing.push('dist/entry.(m)js (read failed)')
  }

  return { ok: missing.length === 0, missing }
}
