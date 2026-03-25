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

function collectControlUiRefsFromHtml(html: string): string[] {
  const refs: string[] = []
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi
  const preloadRe = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi
  const preloadRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(html))) {
    refs.push(m[1])
  }
  while ((m = preloadRe.exec(html))) {
    refs.push(m[1])
  }
  while ((m = preloadRe2.exec(html))) {
    refs.push(m[1])
  }
  return [...new Set(refs)]
}

function resolveControlUiRef(controlUiRoot: string, ref: string): string {
  const s = ref.trim()
  if (s.startsWith('/')) {
    return path.join(controlUiRoot, s.replace(/^\//, ''))
  }
  return path.join(controlUiRoot, s.replace(/^\.\//, ''))
}

function validateControlUiBundle(openclawDir: string): string[] {
  const missing: string[] = []
  const controlUiRoot = path.join(openclawDir, 'dist', 'control-ui')
  const indexPath = path.join(controlUiRoot, 'index.html')
  if (!fileExists(indexPath)) {
    missing.push('dist/control-ui/index.html')
    return missing
  }

  try {
    const html = fs.readFileSync(indexPath, 'utf-8')
    const refs = collectControlUiRefsFromHtml(html).filter((r) => r && !/^(https?:|data:)/i.test(r))
    if (refs.length === 0) {
      missing.push('dist/control-ui/index.html (no local script/modulepreload refs)')
      return missing
    }
    for (const ref of refs) {
      const abs = resolveControlUiRef(controlUiRoot, ref)
      if (!fileExists(abs)) {
        missing.push(path.relative(openclawDir, abs).replace(/\\/g, '/'))
      }
    }
  } catch {
    missing.push('dist/control-ui/index.html (read failed)')
  }

  return missing
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

  missing.push(...validateControlUiBundle(openclawDir))

  return { ok: missing.length === 0, missing }
}
