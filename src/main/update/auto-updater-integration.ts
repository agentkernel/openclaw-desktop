/**
 * electron-updater 集成 — 检查、下载、安装生命周期
 * 支持 stable/beta 通道，开发模式下 graceful 降级
 */

import { app } from 'electron'
import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater'
import { IPC_UPDATE_AVAILABLE, IPC_UPDATE_PROGRESS } from '../../shared/ipc-channels.js'
import type { UpdateCheckResult } from '../../shared/types.js'

export type SendToRenderer = (channel: string, ...args: unknown[]) => void

let sendToRenderer: SendToRenderer = () => {}
let currentCancellationToken: CancellationToken | null = null

/**
 * 初始化 autoUpdater，绑定事件并推送到 Renderer
 * 仅在打包应用时启用；开发模式跳过
 */
type ReadShellConfig = () => { updateChannel?: string }

export function initAutoUpdater(
  readShellConfig: ReadShellConfig,
  send: SendToRenderer,
): void {
  sendToRenderer = send

  if (!app.isPackaged) {
    return
  }

  try {
    const config = readShellConfig()
    autoUpdater.channel = config?.updateChannel === 'beta' ? 'beta' : 'stable'
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      sendToRenderer(IPC_UPDATE_AVAILABLE, {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
        downloadUrl: (info as { downloadedFile?: string }).downloadedFile,
      })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      sendToRenderer(IPC_UPDATE_PROGRESS, {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    autoUpdater.on('update-downloaded', () => {
      sendToRenderer(IPC_UPDATE_PROGRESS, { percent: 100, completed: true })
    })

    autoUpdater.on('error', (err) => {
      sendToRenderer(IPC_UPDATE_PROGRESS, {
        percent: 0,
        error: err?.message ?? String(err),
      })
    })
  } catch (err) {
    console.warn('[update] autoUpdater init skipped:', err instanceof Error ? err.message : String(err))
  }
}

/**
 * 使用 autoUpdater 检查更新
 * 仅在打包应用时使用；否则返回 null 表示需降级
 */
export async function checkForUpdatesWithAutoUpdater(
  readShellConfig: ReadShellConfig,
): Promise<UpdateCheckResult | null> {
  if (!app.isPackaged) {
    return null
  }

  try {
    const config = readShellConfig()
    autoUpdater.channel = config?.updateChannel === 'beta' ? 'beta' : 'stable'

    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
      }
    }

    const info = result.updateInfo
    const latestVersion = typeof info.version === 'string' ? info.version : String(info.version ?? '')
    const currentVersion = app.getVersion()

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      publishedAt: info.releaseDate,
      downloadUrl: (info as { downloadedFile?: string }).downloadedFile,
    }
  } catch {
    return null
  }
}

/**
 * 下载更新
 * 进度通过 IPC_UPDATE_PROGRESS 推送；完成时 promise resolve
 */
export async function downloadShellUpdate(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('Updates are not available in development mode')
  }

  const token = new CancellationToken()
  currentCancellationToken = token

  try {
    await autoUpdater.downloadUpdate(token)
  } finally {
    currentCancellationToken = null
  }
}

/**
 * 取消当前下载
 */
export function cancelShellDownload(): void {
  if (currentCancellationToken) {
    currentCancellationToken.cancel()
    currentCancellationToken = null
  }
}

/**
 * 执行安装（由 installShellUpdateWithBackup 在备份后调用）
 * 安装会立即退出应用，调用后不会返回
 */
export function quitAndInstallShell(): void {
  if (!app.isPackaged) {
    throw new Error('Updates are not available in development mode')
  }
  autoUpdater.quitAndInstall(false, true)
}
