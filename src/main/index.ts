import { app, dialog, Menu, Notification, session, screen } from 'electron'
import path from 'node:path'
import { IPC_GATEWAY_LOG, IPC_GATEWAY_STATUS_CHANGE, IPC_STREAM_GATEWAY_LOGS, IPC_UPDATE_AVAILABLE } from '../shared/ipc-channels.js'
import { APP_NAME, DEFAULT_GATEWAY_PORT, OPENCLAW_CONFIG_FILE } from '../shared/constants.js'
import { getLogAggregator, runPrestartCheck } from './diagnostics/index.js'
import {
  readOpenClawConfig,
  writeOpenClawConfig,
  openclawConfigExists,
  readShellConfig,
  writeShellConfig,
} from './config/index.js'
import { GatewayProcessManager } from './gateway/index.js'
import { registerIpcHandlers, removeIpcHandlers } from './ipc/index.js'
import { TrayManager } from './tray/index.js'
import { WindowManager } from './window/index.js'
import { checkPort } from './utils/port-check.js'
import { getUserDataDir, getInstallDir, getBundledOpenClawPath } from './utils/paths.js'
import { getAppVersions } from './utils/versions.js'
import { initShellLog, logError, logInfo, logWarn } from './utils/logger.js'
import { initAutoUpdater, runPostUpdateValidationIfNeeded, checkForUpdates } from './update/index.js'
import { startBackgroundUpdateCheck, stopBackgroundUpdateCheck } from './update/background-check.js'
import { parseGatewayLogLine } from './logs/index.js'
import { migrateAuthProfilesIfNeeded } from './wizard/index.js'
import { syncLoginItemToSystem, getLoginItemOpenAtLogin, clearLoginItem } from './login-item/index.js'
import { patchGatewayResponseHeaders } from './security/gateway-response-headers.js'
import { rewriteGatewayRequestUrlWithToken } from './security/gateway-request-auth.js'
import { listPendingFeishuPairing } from './pairing/index.js'
import { resolveTrayLocale, getFeishuPairingNotificationStrings, formatFeishuPairingBody } from './tray/tray-i18n.js'
import { registerShellFileProtocol, registerShellPrivileges } from './shell-protocol.js'

/** Must run before app 'ready' so the shell can use openclaw-shell:// instead of file:// */
registerShellPrivileges()

process.on('uncaughtException', (error) => {
  if ((error as NodeJS.ErrnoException).code === 'EPIPE') return
  logError(`[uncaughtException] ${error.stack ?? error.message}`)
  dialog.showErrorBox('Unexpected Error', error.stack ?? error.message)
})
let isQuitting = false
let feishuPairingNotifyTimer: ReturnType<typeof setInterval> | null = null
const windowManager = new WindowManager({
  defaultGatewayPort: DEFAULT_GATEWAY_PORT,
  readShellConfig,
  writeShellConfig,
  isQuitting: () => isQuitting,
})

const trayManager = new TrayManager({
  appName: APP_NAME,
  resolveTrayLocale: () => resolveTrayLocale(readShellConfig),
  onOpenMainWindow: () => windowManager.showMainWindow(),
  onOpenSettings: () => windowManager.showShellRoute('#settings'),
  onOpenFeishuSettings: () => windowManager.showShellRoute('#feishu-settings'),
  onOpenAbout: () => windowManager.showShellRoute('#about'),
  onOpenUpdates: () => windowManager.showShellRoute('#updates'),
  onRestartGateway: async () => {
    await gatewayManager.restart()
  },
  onQuit: () => {
    app.quit()
  },
})

const logAggregator = getLogAggregator()
const gatewayManager = new GatewayProcessManager({
  onStatusChange: (status) => {
    trayManager.setGatewayStatus(status.status)
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_GATEWAY_STATUS_CHANGE, status)
    }
  },
  onLog: (log) => {
    const structured = parseGatewayLogLine(log.message, log.stream)
    logAggregator.append(structured.source, structured.level, structured.message)
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_GATEWAY_LOG, { level: structured.level, message: structured.message })
      mainWindow.webContents.send(IPC_STREAM_GATEWAY_LOGS, structured)
    }
  },
})

async function cleanupBeforeQuit(): Promise<void> {
  if (isQuitting) return
  isQuitting = true

  // 1. Persist window bounds
  windowManager.persistWindowBounds()

  // 2. Stop child processes (gateway)
  await gatewayManager.stop(5000)

  // 3. Tear down tray
  trayManager.destroy()

  // 4. Remove IPC handlers
  removeIpcHandlers()

  // 5. Stop background update polling
  stopBackgroundUpdateCheck()

  if (feishuPairingNotifyTimer) {
    clearInterval(feishuPairingNotifyTimer)
    feishuPairingNotifyTimer = null
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('OpenClaw.Desktop')
  }

  // Uninstaller: --clear-login-item (called from NSIS) removes login item
  if (process.argv.includes('--clear-login-item')) {
    clearLoginItem()
    app.exit(0)
    return
  }

  Menu.setApplicationMenu(null) // Remove View, File, etc. menu bar
  initShellLog()
  registerShellFileProtocol()

  // Allow Control UI to be embedded in our Shell iframe: OpenClaw sets X-Frame-Options: DENY
  // and frame-ancestors 'none', which would block the iframe. We intercept and relax these
  // only for Gateway loopback responses so the Shell can embed the Control UI.
  let loggedGatewayHeaderPatch = false
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const patchedHeaders = patchGatewayResponseHeaders(details.url, details.responseHeaders)
    if (patchedHeaders) {
      if (!loggedGatewayHeaderPatch && details.resourceType === 'subFrame') {
        loggedGatewayHeaderPatch = true
        logInfo(`[OpenClaw] Patched gateway response headers for iframe: ${details.url}`)
      }
      callback({ responseHeaders: patchedHeaders })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })
  let loggedGatewayTokenPatch = false
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== 'webSocket') {
      callback({})
      return
    }

    const cfg = readOpenClawConfig()
    const port = cfg?.gateway?.port ?? DEFAULT_GATEWAY_PORT
    const token = cfg?.gateway?.auth?.token
    const redirectURL = rewriteGatewayRequestUrlWithToken(details.url, { port, token })

    if (redirectURL) {
      if (!loggedGatewayTokenPatch) {
        loggedGatewayTokenPatch = true
        logInfo(`[OpenClaw] Patched gateway websocket request with auth token: ${details.url}`)
      }
      callback({ redirectURL })
      return
    }

    callback({})
  })
  logInfo(`[OpenClaw] App starting. packaged=${String(app.isPackaged)}`)
  logInfo(`[OpenClaw] paths: exe=${app.getPath('exe')} appPath=${app.getAppPath()} resources=${process.resourcesPath}`)
  logInfo(`[OpenClaw] installDir=${getInstallDir()} userDataDir=${getUserDataDir()}`)

  // 1. Single-instance lock
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    logWarn('[OpenClaw] Single instance lock failed; exiting.')
    dialog.showErrorBox(
      'OpenClaw is already running',
      'Another OpenClaw instance is running. Please quit from the system tray first, then restart.',
    )
    app.quit()
    return
  }
  logInfo('[OpenClaw] Single instance lock acquired.')

  app.on('second-instance', () => {
    windowManager.showMainWindow()
    windowManager.reloadMainWindow()
    logInfo('[OpenClaw] Second instance attempted, focusing existing window')
  })

  // 2. Load config
  let shellConfig = readShellConfig()
  void readOpenClawConfig() // Warm cache for gateway and other main-path users
  migrateAuthProfilesIfNeeded() // Migrate legacy credentials/ → agents/main/agent (upstream layout)
  if (!openclawConfigExists()) {
    // First-run wizard: reset to stable window size (ignore stale bounds).
    shellConfig = {
      ...shellConfig,
      windowBounds: {
        x: -1,
        y: -1,
        width: 980,
        height: 920,
        maximized: false,
      },
    }
    writeShellConfig(shellConfig)
  }

  // 2.5 Login item: sync OS state → ShellConfig, then apply
  const sysOpenAtLogin = getLoginItemOpenAtLogin()
  if (sysOpenAtLogin !== shellConfig.autoStart) {
    shellConfig = { ...shellConfig, autoStart: sysOpenAtLogin }
    writeShellConfig(shellConfig)
  }
  syncLoginItemToSystem(shellConfig.autoStart)

  // 3. Register IPC handlers
  registerIpcHandlers({
    gatewayManager,
    readOpenClawConfig,
    writeOpenClawConfig,
    openclawConfigExists,
    readShellConfig,
    writeShellConfig,
    checkPort,
    getUserDataDir,
    getBundledOpenClawPath,
    getVersions: () => getAppVersions(getInstallDir()),
    resizeMainWindow: (width: number, height: number, center?: boolean) => {
      const win = windowManager.getMainWindow()
      if (win && !win.isDestroyed() && !win.isMaximized()) {
        const [currentWidth, currentHeight] = win.getSize()
        if (currentWidth < width || currentHeight < height) {
          win.setSize(Math.max(currentWidth, width), Math.max(currentHeight, height))
          if (center) win.center()
        }
      }
    },
    resizeForMainInterface: () => {
      const win = windowManager.getMainWindow()
      if (win && !win.isDestroyed() && !win.isMaximized()) {
        const display = screen.getDisplayMatching(win.getBounds())
        const workArea = display.workAreaSize
        const targetWidth = Math.max(980, Math.min(1440, workArea.width))
        const targetHeight = Math.max(700, Math.min(960, workArea.height))
        win.setSize(targetWidth, targetHeight)
        win.center()
      }
    },
    setMainWindowTitle: (title: string) => {
      windowManager.setMainWindowTitle(title)
    },
    refreshTrayMenu: () => {
      trayManager.refreshMenu()
    },
  })

  // 4. Main window (packaged: loadFile from asar.unpacked renderer to avoid blank screen)
  logInfo('[OpenClaw] Creating main window...')
  windowManager.createMainWindow()
  logInfo('[OpenClaw] Main window created.')

  // 4.5 Post-update validation if .post-update-pending marker exists
  void runPostUpdateValidationIfNeeded({
    readOpenClawConfig: () => readOpenClawConfig() ?? {},
    readShellConfig: () => readShellConfig(),
    gatewayStatus: () => {
      const s = gatewayManager.getStatus()
      return { running: s.running, status: s.status }
    },
  })

  // Forward electron-updater events to renderer (packaged builds)
  const sendToRenderer = (channel: string, ...args: unknown[]) => {
    const win = windowManager.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
  initAutoUpdater(readShellConfig, sendToRenderer)

  startBackgroundUpdateCheck(
    readShellConfig,
    (partial) => {
      const cfg = readShellConfig()
      writeShellConfig({ ...cfg, ...partial })
    },
    () => checkForUpdates(readShellConfig).then((r) => ({ hasUpdate: r.hasUpdate ?? false, latestVersion: r.latestVersion })),
    (info) => {
      trayManager.setUpdateAvailable(true)
      sendToRenderer(IPC_UPDATE_AVAILABLE, info)
    },
  )

  trayManager.create()
  trayManager.setGatewayStatus(gatewayManager.getStatus().status)

  const notifiedFeishuPairingCodes = new Set<string>()
  const pollFeishuPairingNotifications = () => {
    void listPendingFeishuPairing()
      .then(({ requests }) => {
        for (const row of requests) {
          const code = row.code.trim().toUpperCase()
          if (!code || notifiedFeishuPairingCodes.has(code)) continue
          notifiedFeishuPairingCodes.add(code)
          if (!Notification.isSupported()) continue
          const loc = resolveTrayLocale(readShellConfig)
          const notifCopy = getFeishuPairingNotificationStrings(loc)
          const n = new Notification({
            title: notifCopy.title,
            body: formatFeishuPairingBody(notifCopy.bodyTemplate, row.code),
          })
          n.on('click', () => {
            windowManager.showShellRoute('#feishu-settings')
          })
          n.show()
        }
      })
      .catch(() => {})
  }
  feishuPairingNotifyTimer = setInterval(pollFeishuPairingNotifications, 12_000)
  pollFeishuPairingNotifications()

  // 5. Pre-start checks (bundle + config)
  const prestartCheck = runPrestartCheck()
  if (!prestartCheck.ok) {
    const detail =
      prestartCheck.errors.join('\n\n') +
      (prestartCheck.fixSuggestions.length > 0
        ? '\n\nSuggestions:\n' + prestartCheck.fixSuggestions.map((s) => `• ${s}`).join('\n')
        : '')
    logError(`[OpenClaw] Prestart check failed: ${prestartCheck.errors.join('; ')}`)
    dialog.showErrorBox('Startup check failed', detail)
    windowManager.showErrorPage(
      'Startup check failed',
      detail,
    )
    windowManager.showMainWindow()
    return
  }

  // 6. If config exists, start gateway from main (don’t wait for renderer)
  if (openclawConfigExists()) {
    const cfg = readOpenClawConfig()
    const gw = cfg?.gateway
    const port = gw?.port ?? DEFAULT_GATEWAY_PORT
    const bind = gw?.bind ?? 'loopback'
    const token = gw?.auth?.token?.trim()
    const force = Boolean(gw?.forcePortOnConflict)
    void gatewayManager.start({ port, bind, token: token || undefined, force }).catch((err) => {
      logError(`[OpenClaw] Failed to auto-start Gateway: ${err instanceof Error ? err.message : String(err)}`)
    })
  } else {
    const configPath = path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
    logWarn(`[OpenClaw] openclaw.json not found at ${configPath}; Gateway will not auto-start. Complete the setup wizard first.`)
  }

  app.on('activate', () => {
    if (windowManager.getMainWindow() === null) {
      windowManager.createMainWindow()
      return
    }
    windowManager.showMainWindow()
  })
})

app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  void cleanupBeforeQuit().finally(() => {
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
