import { app, dialog, Menu, session } from 'electron'
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

process.on('uncaughtException', (error) => {
  if ((error as NodeJS.ErrnoException).code === 'EPIPE') return
  logError(`[uncaughtException] ${error.stack ?? error.message}`)
  dialog.showErrorBox('Unexpected Error', error.stack ?? error.message)
})
let isQuitting = false
const windowManager = new WindowManager({
  defaultGatewayPort: DEFAULT_GATEWAY_PORT,
  readShellConfig,
  writeShellConfig,
  isQuitting: () => isQuitting,
})

const trayManager = new TrayManager({
  appName: APP_NAME,
  onOpenMainWindow: () => windowManager.showMainWindow(),
  onOpenSettings: () => windowManager.showShellRoute('#settings'),
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

  // 1. 保存窗口 bounds
  windowManager.persistWindowBounds()

  // 2. 子进程清理（Gateway）
  await gatewayManager.stop(5000)

  // 3. 托盘清理
  trayManager.destroy()

  // 4. IPC 处理器清理
  removeIpcHandlers()

  // 5. 后台更新检查清理
  stopBackgroundUpdateCheck()
}

app.whenReady().then(() => {
  // 卸载时清除登录项：支持 --clear-login-item 参数供 NSIS 卸载脚本调用
  if (process.argv.includes('--clear-login-item')) {
    clearLoginItem()
    app.exit(0)
    return
  }

  Menu.setApplicationMenu(null) // Remove View, File, etc. menu bar
  initShellLog()

  // Allow Control UI to be embedded in our Shell iframe: OpenClaw sets X-Frame-Options: DENY
  // and frame-ancestors 'none', which would block the iframe. We intercept and relax these
  // only for Gateway (127.0.0.1) responses so the Shell can embed the Control UI.
  let loggedGatewayHeaderPatch = false
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://[::1]:')) {
      const headers = { ...details.responseHeaders }
      const headerKeys = Object.keys(headers)

      // Electron preserves header key casing; remove all X-Frame-Options variants.
      for (const key of headerKeys) {
        if (key.toLowerCase() === 'x-frame-options') {
          delete headers[key]
        }
      }

      const cspKey = headerKeys.find((key) => key.toLowerCase() === 'content-security-policy')
      if (cspKey) {
        const cspRaw = headers[cspKey]
        const relaxFrameAncestors = (value: string) =>
          value.replace(
            /frame-ancestors\s+[^;]+/i,
            "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*",
          )

        if (Array.isArray(cspRaw)) {
          headers[cspKey] = cspRaw.map((v) => relaxFrameAncestors(String(v)))
        } else if (cspRaw) {
          headers[cspKey] = [relaxFrameAncestors(String(cspRaw))]
        }
      } else {
        headers['Content-Security-Policy'] = ["frame-ancestors 'self' http://localhost:* http://127.0.0.1:*"]
      }
      if (!loggedGatewayHeaderPatch && details.resourceType === 'subFrame') {
        loggedGatewayHeaderPatch = true
        logInfo(`[OpenClaw] Patched gateway response headers for iframe: ${url}`)
      }
      callback({ responseHeaders: headers })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })
  logInfo(`[OpenClaw] App starting. packaged=${String(app.isPackaged)}`)
  logInfo(`[OpenClaw] paths: exe=${app.getPath('exe')} appPath=${app.getAppPath()} resources=${process.resourcesPath}`)
  logInfo(`[OpenClaw] installDir=${getInstallDir()} userDataDir=${getUserDataDir()}`)

  // 1. 单实例检查
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

  // 2. 加载配置
  let shellConfig = readShellConfig()
  void readOpenClawConfig() // 预加载，供后续 Gateway 等使用
  migrateAuthProfilesIfNeeded() // 迁移 credentials/ 到 agents/main/agent（原生路径）

  // 2.5 开机自启：检测系统登录项状态并同步到 ShellConfig，再应用到系统
  const sysOpenAtLogin = getLoginItemOpenAtLogin()
  if (sysOpenAtLogin !== shellConfig.autoStart) {
    shellConfig = { ...shellConfig, autoStart: sysOpenAtLogin }
    writeShellConfig(shellConfig)
  }
  syncLoginItemToSystem(shellConfig.autoStart)

  // 3. 注册 IPC 处理器
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
        // 主界面（Control UI）宽度 1280，向导保持 980
        win.setSize(1280, 920)
        win.center()
      }
    },
  })

  // 4. 创建主窗口（打包时用 loadFile 加载 app.asar.unpacked 内 renderer，避免白屏）
  logInfo('[OpenClaw] Creating main window...')
  windowManager.createMainWindow()
  logInfo('[OpenClaw] Main window created.')

  // 4.5 安装后校验（若有 .post-update-pending marker，执行 doctor+bundle 校验）
  void runPostUpdateValidationIfNeeded({
    readOpenClawConfig: () => readOpenClawConfig() ?? {},
    readShellConfig: () => readShellConfig(),
    gatewayStatus: () => {
      const s = gatewayManager.getStatus()
      return { running: s.running, status: s.status }
    },
  })

  // electron-updater 事件推送到 Renderer（打包应用时）
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

  // 5. 启动前校验（bundle + config）
  const prestartCheck = runPrestartCheck()
  if (!prestartCheck.ok) {
    const detail =
      prestartCheck.errors.join('\n\n') +
      (prestartCheck.fixSuggestions.length > 0
        ? '\n\n修复建议:\n' + prestartCheck.fixSuggestions.map((s) => `• ${s}`).join('\n')
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

  // 6. 若已有配置，主进程先尝试启动 Gateway（避免 renderer 未加载导致不启动）
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
