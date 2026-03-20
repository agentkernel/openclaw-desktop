import { app, BrowserWindow, shell, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { ShellConfig } from '../../shared/types.js'
import { APP_NAME } from '../../shared/constants.js'
import { logError, logInfo, logWarn } from '../utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getPackagedRendererCandidates(): string[] {
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'renderer', 'index.html')
  const asar = path.join(app.getAppPath(), 'out', 'renderer', 'index.html')
  return [unpacked, asar]
}

/** Packaged build: loadFile from unpacked path so file:// resolves relative assets */
function getRendererIndexPath(): string {
  if (app.isPackaged) {
    for (const candidate of getPackagedRendererCandidates()) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }
  return path.join(__dirname, '../renderer/index.html')
}

/** Packaged preload path */
function getPreloadCandidates(): string[] {
  const unpackedBase = path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'preload')
  const asarBase = path.join(app.getAppPath(), 'out', 'preload')
  return [
    path.join(unpackedBase, 'index.cjs'),
    path.join(unpackedBase, 'index.mjs'),
    path.join(unpackedBase, 'index.js'),
    path.join(asarBase, 'index.cjs'),
    path.join(asarBase, 'index.mjs'),
    path.join(asarBase, 'index.js'),
  ]
}

function getWindowIconPath(): string | null {
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  const candidates = [
    path.join(baseDir, 'apple-touch-icon.png'),
    path.join(baseDir, 'resources', 'apple-touch-icon.png'),
    path.join(baseDir, 'resources', 'icon.ico'),
    path.join(baseDir, 'resources', 'tray-icon.png'),
    path.join(baseDir, 'build', 'tray-icon.png'),
    path.join(baseDir, 'build', 'icon.ico'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function getPreloadPath(): string {
  if (app.isPackaged) {
    for (const candidate of getPreloadCandidates()) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }
  return path.join(__dirname, '../preload/index.cjs')
}

export interface WindowManagerOptions {
  defaultGatewayPort: number
  readShellConfig: () => ShellConfig
  writeShellConfig: (config: ShellConfig) => void
  isQuitting: () => boolean
}

export function createControlUIUrl(port: number): string {
  return `http://127.0.0.1:${port}/`
}

function getDevRendererOrigin(): string | null {
  const raw = process.env.ELECTRON_RENDERER_URL
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return null
  }
}

export function isControlUIUrl(url: string, port: number): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === String(port)
  } catch {
    return false
  }
}

function isAllowedNavigation(url: string, port: number): boolean {
  if (url === 'about:blank') return true
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol === 'file:' || parsed.protocol === 'data:') {
    return true
  }

  if (isControlUIUrl(url, port)) {
    return true
  }

  const devOrigin = getDevRendererOrigin()
  if (devOrigin && parsed.origin === devOrigin) {
    return true
  }

  return false
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private readonly defaultGatewayPort: number
  private readonly readShellConfig: () => ShellConfig
  private readonly writeShellConfig: (config: ShellConfig) => void
  private readonly isQuitting: () => boolean

  constructor(options: WindowManagerOptions) {
    this.defaultGatewayPort = options.defaultGatewayPort
    this.readShellConfig = options.readShellConfig
    this.writeShellConfig = options.writeShellConfig
    this.isQuitting = options.isQuitting
  }

  createMainWindow(): BrowserWindow {
    const shellConfig = this.readShellConfig()
    const port = shellConfig.lastGatewayPort || this.defaultGatewayPort
    const windowBounds = shellConfig.windowBounds
    const preloadPath = getPreloadPath()
    const preloadExists = fs.existsSync(preloadPath)
    logInfo(`[OpenClaw] createMainWindow: port=${port} preload=${preloadPath} exists=${String(preloadExists)}`)
    if (app.isPackaged && !preloadExists) {
      logWarn(`[OpenClaw] Preload not found, window without preload: ${preloadPath}`)
    }
    const iconPath = getWindowIconPath()
    const shouldCenter = windowBounds.x < 0 || windowBounds.y < 0
    const window = new BrowserWindow({
      ...(shouldCenter ? {} : { x: windowBounds.x, y: windowBounds.y }),
      width: Math.max(windowBounds.width, 800),
      height: Math.max(windowBounds.height, 600),
      minWidth: 800,
      minHeight: 600,
      show: false,
      center: shouldCenter,
      title: APP_NAME,
      icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
      webPreferences: {
        ...(preloadExists ? { preload: preloadPath } : {}),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    this.mainWindow = window
    this.attachNavigationGuards(window, port)
    this.attachBoundsPersistence(window)
    this.attachCloseBehavior(window)

    window.on('closed', () => {
      if (this.mainWindow === window) {
        this.mainWindow = null
      }
    })

    const showWhenReady = () => {
      if (!window.isDestroyed() && !window.isVisible()) {
        window.show()
        if (windowBounds.maximized) window.maximize()
      }
    }
    if (!app.isPackaged) {
      window.once('ready-to-show', showWhenReady)
    }
    // When packaged: do NOT show on ready-to-show (would show bootstrap/black screen).
    // Show only after the actual renderer (index.html) has loaded.

    let loadErrorShown = false
    const showLoadError = (title: string, detail: string) => {
      if (loadErrorShown) return
      loadErrorShown = true
      const html = buildErrorHtml(title, detail)
      window.setBackgroundColor('#1a1a1a')
      const showNow = () => {
        if (!window.isDestroyed()) showWhenReady()
      }
      window
        .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
        .then(showNow)
        .catch(showNow)
    }

    const openDevToolsIfRequested = () => {
      if (process.env.OPENCLAW_DEVTOOLS === '1') {
        window.webContents.openDevTools({ mode: 'detach' })
      }
    }

    if (process.env.ELECTRON_RENDERER_URL) {
      void window.loadURL(process.env.ELECTRON_RENDERER_URL).then(openDevToolsIfRequested)
    } else if (app.isPackaged) {
      const rendererPath = getRendererIndexPath()
      const rendererCandidates = getPackagedRendererCandidates()
      logInfo(
        `[OpenClaw] Packaged: rendererPath=${rendererPath} candidates=${JSON.stringify(
          rendererCandidates,
        )} exists=${JSON.stringify(rendererCandidates.map((p) => fs.existsSync(p)))}`
      )
      const bootstrapHtml =
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${APP_NAME}</title></head><body style="margin:0;background:transparent;"></body></html>`
      void window
        .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(bootstrapHtml))
        .then(() => {
          openDevToolsIfRequested()
          if (window.isDestroyed()) return
          void window
            .loadFile(rendererPath)
            .then(() => {
              if (!window.isDestroyed()) showWhenReady()
            })
            .catch((err) => {
              logError(`[OpenClaw] Failed to load renderer: ${rendererPath} ${(err instanceof Error ? err.message : String(err))}`)
              showLoadError(
                'Renderer load failed',
                `Path: ${rendererPath}\n\nError: ${err instanceof Error ? err.message : String(err)}\n\n` +
                  `Check that dist\\win-unpacked\\resources\\app.asar.unpacked\\out\\renderer or resources\\app.asar\\out\\renderer exists.`,
              )
              if (!window.isDestroyed()) showWhenReady()
            })
        })
        .catch(() => {
          showLoadError('Bootstrap failed', 'Unable to load bootstrap page')
          if (!window.isDestroyed()) showWhenReady()
        })
    } else {
      const rendererPath = getRendererIndexPath()
      void window
        .loadFile(rendererPath)
        .then(openDevToolsIfRequested)
        .catch((err) => {
          logError(`[OpenClaw] Failed to load renderer: ${rendererPath} ${(err instanceof Error ? err.message : String(err))}`)
          const msg = err instanceof Error ? err.message : String(err)
          showLoadError('Renderer load failed', `Path: ${rendererPath}\nError: ${msg}`)
        })
    }

    if (app.isPackaged) {
      window.webContents.on('did-start-loading', () => {
        logInfo(`[OpenClaw] did-start-loading ${window.webContents.getURL()}`)
      })
      window.webContents.on('did-finish-load', () => {
        logInfo(`[OpenClaw] did-finish-load ${window.webContents.getURL()}`)
      })
    }
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return
      const url = validatedURL ?? '(empty)'
      const isControlUi = validatedURL ? isControlUIUrl(validatedURL, port) : false
      logError(`[OpenClaw] Page failed to load: code=${errorCode} desc=${errorDescription} url=${url}`)

      if (isControlUi) {
        showLoadError(
          'Gateway not ready',
          `Control UI could not load. Gateway may not have started or failed.\n\n` +
            `url: ${url}\n` +
            `code: ${errorCode}\n` +
            `description: ${errorDescription}\n\n` +
            `Check %USERPROFILE%\\.openclaw\\logs or restart Gateway from the tray menu.`,
        )
        return
      }

      if (validatedURL && (validatedURL.startsWith('file:') || validatedURL.startsWith('data:'))) {
        const title = 'Page load failed (did-fail-load)'
        const detail = `code: ${errorCode}\ndescription: ${errorDescription}\nurl: ${url}`
        showLoadError(title, detail)
      }
    })

    return window
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  showMainWindow(): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) {
      return
    }
    if (window.isMinimized()) {
      window.restore()
    }
    if (!window.isVisible()) {
      window.show()
    }
    window.focus()
  }

  /**
   * Load the shell renderer with a hash route (e.g. #settings, #about).
   * Use when user clicks Settings/About from tray while Control UI is shown.
   */
  showShellRoute(hash: string): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    const safeHash = hash.startsWith('#') ? hash : `#${hash}`
    if (process.env.ELECTRON_RENDERER_URL) {
      const base = process.env.ELECTRON_RENDERER_URL.replace(/#.*$/, '')
      void window.loadURL(`${base}${safeHash}`)
    } else {
      const rendererPath = getRendererIndexPath()
      const fileUrl = pathToFileURL(rendererPath).href + safeHash
      void window.loadURL(fileUrl)
    }
    this.showMainWindow()
  }

  showErrorPage(title: string, detail: string): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    const html = buildErrorHtml(title, detail)
    window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {})
  }

  reloadMainWindow(): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) {
      return
    }
    logInfo('[OpenClaw] Reloading main window on second-instance.')
    window.webContents.reload()
  }

  persistWindowBounds(): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) {
      return
    }

    const shellConfig = this.readShellConfig()
    shellConfig.windowBounds = {
      ...window.getBounds(),
      maximized: window.isMaximized(),
    }
    this.writeShellConfig(shellConfig)
  }

  private attachBoundsPersistence(window: BrowserWindow): void {
    const persist = () => {
      this.persistWindowBounds()
    }

    window.on('resize', persist)
    window.on('move', persist)
  }

  private attachCloseBehavior(window: BrowserWindow): void {
    window.on('close', (event) => {
      const shellConfig = this.readShellConfig()
      const shouldCloseToTray = shellConfig.closeToTray && !this.isQuitting()
      if (shouldCloseToTray) {
        event.preventDefault()
        window.hide()
        return
      }

      this.persistWindowBounds()
    })
  }

  private attachNavigationGuards(window: BrowserWindow, port: number): void {
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (!isAllowedNavigation(url, port)) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    window.webContents.on('will-navigate', (event, url) => {
      if (isAllowedNavigation(url, port)) {
        return
      }
      event.preventDefault()
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          void shell.openExternal(url)
        }
      } catch {
        // ignore invalid URLs
      }
    })
  }
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildErrorHtml(title: string, detail: string): string {
  const escapedTitle = escapeHtml(title)
  const escaped = escapeHtml(detail).replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${APP_NAME}</title><style>body{font-family:system-ui;padding:2rem;max-width:640px;margin:0 auto;background:#1a1a1a;color:#eee;}h1{color:#ff6b6b;} .detail{background:#333;padding:1rem;overflow:auto;font-size:12px;white-space:pre-wrap;} .tip{margin-top:1.5rem;color:#888;font-size:14px;}</style></head><body><h1>${escapedTitle}</h1><div class="detail">${escaped}</div><p class="tip">Debug: Set OPENCLAW_DEVTOOLS=1 and restart the exe to open DevTools.</p></body></html>`
}
