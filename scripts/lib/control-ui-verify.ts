/**
 * OpenClaw Control UI static bundle checks (missing assets + JS syntax).
 * Catches mixed/truncated Vite output that passes "file exists" but breaks at runtime.
 */

import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { transformSync } from 'esbuild'

export function resolveControlUiRef(controlUiRoot: string, ref: string): string {
  const s = ref.trim()
  if (s.startsWith('/')) {
    return join(controlUiRoot, s.replace(/^\//, ''))
  }
  return join(controlUiRoot, s.replace(/^\.\//, ''))
}

export function collectRefsFromControlUiHtml(html: string): string[] {
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
  return refs
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export async function verifyControlUiBundle(controlUiRoot: string): Promise<void> {
  const indexPath = join(controlUiRoot, 'index.html')
  if (!(await fileExists(indexPath))) {
    throw new Error(`Control UI missing: ${indexPath}`)
  }
  const html = await readFile(indexPath, 'utf8')
  const refs = collectRefsFromControlUiHtml(html)
  if (refs.length === 0) {
    throw new Error('control-ui/index.html has no script src / modulepreload href')
  }
  for (const ref of refs) {
    if (/^(https?:|data:)/i.test(ref)) continue
    const abs = resolveControlUiRef(controlUiRoot, ref)
    if (!(await fileExists(abs))) {
      throw new Error(`control-ui index references missing file: ${ref} → ${abs}`)
    }
  }

  const checked = new Set<string>()
  for (const ref of refs) {
    if (/^(https?:|data:)/i.test(ref)) continue
    const pathNoQuery = ref.split('?')[0]
    const lower = pathNoQuery.toLowerCase()
    if (!lower.endsWith('.js') && !lower.endsWith('.mjs')) continue
    const abs = resolveControlUiRef(controlUiRoot, pathNoQuery)
    if (checked.has(abs)) continue
    checked.add(abs)
    const code = await readFile(abs, 'utf8')
    try {
      transformSync(code, {
        loader: 'js',
        logLevel: 'silent',
        target: 'esnext',
        sourcefile: abs,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Control UI script syntax check failed: ${ref}\n${msg}`)
    }
  }
}
