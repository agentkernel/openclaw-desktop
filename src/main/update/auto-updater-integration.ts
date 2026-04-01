/**
 * electron-updater wiring: check / download / install.
 * stable/beta channel; dev mode skips updater gracefully.
 */

import { app } from 'electron'
import {
  autoUpdater,
  CancellationToken,
  type ProgressInfo,
  type UpdateFileInfo,
  type UpdateInfo,
} from 'electron-updater'
import { IPC_UPDATE_AVAILABLE, IPC_UPDATE_PROGRESS } from '../../shared/ipc-channels.js'
import type { UpdateCheckResult } from '../../shared/types.js'

const GITHUB_REPO_RELEASES = 'https://github.com/agentkernel/openclaw-desktop/releases'

function releaseNotesFromUpdateInfo(info: UpdateInfo): string | undefined {
  const n = info.releaseNotes
  if (n == null) return undefined
  if (typeof n === 'string') return n
  if (Array.isArray(n)) {
    return n.map((e) => e.note ?? '').filter(Boolean).join('\n\n')
  }
  return undefined
}

function installerDownloadUrlFromUpdateInfo(info: UpdateInfo): string | undefined {
  const files = info.files
  if (!files?.length) return undefined
  const bySetup = files.find(
    (f: UpdateFileInfo) => /\.exe$/i.test(f.url) && f.url.toLowerCase().includes('setup'),
  )
  if (bySetup) return bySetup.url
  const exe = files.find((f: UpdateFileInfo) => /\.exe$/i.test(f.url))
  return exe?.url
}

function releasePageUrlForVersion(version: string): string {
  const tag = version.startsWith('v') ? version : `v${version}`
  return `${GITHUB_REPO_RELEASES}/tag/${encodeURIComponent(tag)}`
}

export type SendToRenderer = (channel: string, ...args: unknown[]) => void

let sendToRenderer: SendToRenderer = () => {}
let currentCancellationToken: CancellationToken | null = null

/** Emit download progress (used by GitHub fallback downloader and tests). */
export function sendUpdateProgressPayload(payload: Record<string, unknown>): void {
  sendToRenderer(IPC_UPDATE_PROGRESS, payload)
}

/**
 * Init autoUpdater and forward events to renderer (packaged only; dev skips)
 */
type ReadShellConfig = () => { updateChannel?: string }

/**
 * Shell setting `stable` maps to electron-updater channel `latest` so we fetch `latest.yml`
 * (electron-builder default). Using channel `stable` would request `stable.yml` (404 on GitHub).
 */
function electronUpdaterChannel(shellChannel: string | undefined): string {
  return shellChannel === 'beta' ? 'beta' : 'latest'
}

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
    autoUpdater.channel = electronUpdaterChannel(config?.updateChannel)
    // Channel setter flips allowDowngrade to true; we only want upgrades from the feed.
    autoUpdater.allowDowngrade = false
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
    autoUpdater.channel = electronUpdaterChannel(config?.updateChannel)
    autoUpdater.allowDowngrade = false

    const result = await autoUpdater.checkForUpdates()
    if (result == null) {
      return null
    }

    const currentVersion = app.getVersion()
    if (!result.isUpdateAvailable) {
      return { hasUpdate: false, currentVersion }
    }

    const info = result.updateInfo
    const latestVersion = typeof info.version === 'string' ? info.version : String(info.version ?? '')

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      releaseNotes: releaseNotesFromUpdateInfo(info),
      publishedAt: info.releaseDate,
      releaseUrl: releasePageUrlForVersion(latestVersion),
      downloadUrl: installerDownloadUrlFromUpdateInfo(info),
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
