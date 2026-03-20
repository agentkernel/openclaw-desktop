/**
 * electron-updater wiring: check / download / install.
 * stable/beta channel; dev mode skips updater gracefully.
 */

import { app } from 'electron'
import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater'
import { IPC_UPDATE_AVAILABLE, IPC_UPDATE_PROGRESS } from '../../shared/ipc-channels.js'
import type { UpdateCheckResult } from '../../shared/types.js'

export type SendToRenderer = (channel: string, ...args: unknown[]) => void

let sendToRenderer: SendToRenderer = () => {}
let currentCancellationToken: CancellationToken | null = null

/**
 * Init autoUpdater and forward events to renderer (packaged only; dev skips)
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
 * Check via autoUpdater; null in dev (caller falls back)
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
 * Download update; progress on IPC_UPDATE_PROGRESS; resolves when done
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
 * Cancel active download
 */
export function cancelShellDownload(): void {
  if (currentCancellationToken) {
    currentCancellationToken.cancel()
    currentCancellationToken = null
  }
}

/**
 * Quit and install (after backup). Does not return — process exits.
 */
export function quitAndInstallShell(): void {
  if (!app.isPackaged) {
    throw new Error('Updates are not available in development mode')
  }
  autoUpdater.quitAndInstall(false, true)
}
