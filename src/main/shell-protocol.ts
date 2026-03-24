import { app, protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Custom scheme so the shell is not loaded via file:// (module/CORS/CSP edge cases on Windows). */
export const SHELL_CUSTOM_SCHEME = 'openclaw-shell' as const
export const SHELL_CUSTOM_HOST = 'renderer' as const

let rendererRootCache: string | null = null

function getShellRendererRootDir(): string {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'renderer')
    if (fs.existsSync(unpacked)) return unpacked
    return path.join(app.getAppPath(), 'out', 'renderer')
  }
  return path.join(__dirname, '../renderer')
}

function getShellRendererRootCached(): string {
  if (!rendererRootCache) {
    rendererRootCache = path.resolve(getShellRendererRootDir())
  }
  return rendererRootCache
}

/** Call before app 'ready' (Electron requirement). */
export function registerShellPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SHELL_CUSTOM_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

export function getShellIndexPageUrl(hash?: string): string {
  const base = `${SHELL_CUSTOM_SCHEME}://${SHELL_CUSTOM_HOST}/index.html`
  if (!hash) return base
  const h = hash.startsWith('#') ? hash : `#${hash}`
  return `${base}${h}`
}

export function isShellCustomProtocolUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    return u.protocol === `${SHELL_CUSTOM_SCHEME}:` && u.hostname.toLowerCase() === SHELL_CUSTOM_HOST
  } catch {
    return false
  }
}

/** Register after app 'ready', before creating BrowserWindows that load the shell. */
export function registerShellFileProtocol(): void {
  protocol.registerFileProtocol(SHELL_CUSTOM_SCHEME, (request, callback) => {
    try {
      const parsed = new URL(request.url)
      if (parsed.protocol !== `${SHELL_CUSTOM_SCHEME}:`) {
        callback({ error: -2 })
        return
      }
      if (parsed.hostname.toLowerCase() !== SHELL_CUSTOM_HOST) {
        callback({ error: -10 })
        return
      }
      let pathname = decodeURIComponent(parsed.pathname)
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html'
      }
      const relative = pathname.replace(/^\/+/, '')
      if (relative.includes('..')) {
        callback({ error: -10 })
        return
      }
      const root = getShellRendererRootCached()
      const filePath = path.resolve(path.join(root, relative))
      const relToRoot = path.relative(root, filePath)
      if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
        callback({ error: -10 })
        return
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        callback({ error: -6 })
        return
      }
      callback({ path: filePath })
    } catch {
      callback({ error: -2 })
    }
  })
}
