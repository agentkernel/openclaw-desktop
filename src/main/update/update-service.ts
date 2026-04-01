/**
 * Update service: prefer electron-updater, fall back to GitHub API.
 * Bundle verify, pre-start check, backup before install.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import semver from 'semver'
import type {
  UpdateCheckResult,
  BundleVerifyResult,
  PrestartCheckFrontend,
} from '../../shared/types.js'
import { getInstallDir } from '../utils/paths.js'
import { getAppVersions } from '../utils/versions.js'
import { validateOpenclawResources } from '../utils/openclaw-validate.js'
import { runPrestartCheck } from '../diagnostics/prestart-check.js'
import {
  checkForUpdatesWithAutoUpdater,
  downloadShellUpdate,
  cancelShellDownload,
  quitAndInstallShell,
  sendUpdateProgressPayload,
} from './auto-updater-integration.js'
import { spawn } from 'node:child_process'
import { runBackupCreateCli } from '../backup/index.js'
import { getUserDataDir } from '../utils/paths.js'
import { writePostUpdateMarker } from './post-update-validation.js'

const GITHUB_REPO = 'agentkernel/openclaw-desktop'
const MAX_BACKUPS_KEEP = 1
const GITHUB_API_BASE = 'https://api.github.com'

type ReadShellConfig = () => { updateChannel?: string }

/** Set on each successful `checkForUpdates` — drives GitHub-only download when electron-updater did not run a check. */
let lastUpdateCheckMeta: {
  source: 'electron-updater' | 'github-api'
  downloadUrl?: string
  /** GitHub: newer tag than current but no matching .exe asset (or URL missing). */
  githubMissingInstaller?: boolean
} | null = null

/** After `downloadUpdate`: electron-updater path vs installer fetched from GitHub API fallback. */
let lastDownloadMode: 'electron-updater' | 'standalone' | null = null
let lastStandaloneInstallerPath: string | null = null
let standaloneDownloadAbort: AbortController | null = null

interface GitHubRelease {
  tag_name: string
  html_url: string
  body?: string
  published_at?: string
  assets?: Array<{
    name: string
    browser_download_url: string
  }>
}

function normalizeVersion(tag: string): string {
  return tag.replace(/^v/, '').trim()
}

/**
 * Shell versions use semver plus build metadata (e.g. `0.6.4+openclaw.2026.3.31`).
 * Semver ignores build metadata for precedence; we tie-break with a full string compare.
 * Returns negative if a is older than b.
 */
function compareShellVersions(a: string, b: string): number {
  const na = normalizeVersion(a)
  const nb = normalizeVersion(b)
  const pa = semver.parse(na)
  const pb = semver.parse(nb)
  if (pa && pb) {
    const ord = semver.compare(pa, pb)
    if (ord !== 0) return ord
  }
  return na.localeCompare(nb, undefined, { numeric: true, sensitivity: 'base' })
}

function isRemoteVersionNewer(current: string, remote: string): boolean {
  return compareShellVersions(current, remote) < 0
}

function pickWindowsSetupAsset(
  assets: GitHubRelease['assets'] | undefined,
): { browser_download_url: string } | undefined {
  if (!assets?.length) return undefined
  const lower = (n: string) => n.toLowerCase()
  const openclawSetup = assets.find(
    (a) =>
      a.name.endsWith('.exe') &&
      lower(a.name).includes('openclaw') &&
      lower(a.name).includes('setup'),
  )
  if (openclawSetup) return openclawSetup
  const anySetup = assets.find((a) => a.name.endsWith('.exe') && lower(a.name).includes('setup'))
  if (anySetup) return anySetup
  return assets.find((a) => a.name.endsWith('.exe'))
}

function githubApiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'openclaw-desktop-updater (https://github.com/agentkernel/openclaw-desktop)',
  }
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function checkForUpdatesViaGitHub(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`,
    {
      headers: githubApiHeaders(),
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!res.ok) {
    if (res.status === 404) {
      return { hasUpdate: false, currentVersion, error: 'No releases found for this repository.' }
    }
    return { hasUpdate: false, currentVersion, error: `GitHub API returned ${res.status}` }
  }
  const release = (await res.json()) as GitHubRelease
  const latestVersion = normalizeVersion(release.tag_name)
  const hasUpdate = isRemoteVersionNewer(currentVersion, latestVersion)
  const setupAsset = pickWindowsSetupAsset(release.assets)
  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    releaseNotes: release.body?.slice(0, 2000),
    publishedAt: release.published_at,
    downloadUrl: setupAsset?.browser_download_url,
  }
}

export async function checkForUpdates(readShellConfig: ReadShellConfig): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const result = await checkForUpdatesWithAutoUpdater(readShellConfig)
    if (result !== null) {
      lastUpdateCheckMeta = {
        source: 'electron-updater',
        downloadUrl: result.downloadUrl,
        githubMissingInstaller: false,
      }
      return result
    }
  } catch {
    // Fall back to GitHub API
  }
  try {
    const result = await checkForUpdatesViaGitHub()
    lastUpdateCheckMeta = {
      source: 'github-api',
      downloadUrl: result.downloadUrl,
      githubMissingInstaller: result.hasUpdate === true && !result.downloadUrl,
    }
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { hasUpdate: false, currentVersion, error: 'Request timed out. Check your network connection.' }
    }
    return { hasUpdate: false, currentVersion, error: msg }
  }
}

/**
 * Download installer: prefers electron-updater (delta / signed pipeline). If the last check used the
 * GitHub API fallback (electron-updater check failed), downloads the release asset to temp.
 */
export async function downloadUpdate(readShellConfig: ReadShellConfig): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('Updates are not available in development mode')
  }

  lastStandaloneInstallerPath = null
  lastDownloadMode = null

  const r = await checkForUpdatesWithAutoUpdater(readShellConfig)
  if (r?.hasUpdate) {
    lastDownloadMode = 'electron-updater'
    await downloadShellUpdate()
    return
  }

  // Re-check may report no update while updateInfoAndProvider is still set from an earlier check in this session.
  try {
    lastDownloadMode = 'electron-updater'
    await downloadShellUpdate()
    return
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.toLowerCase().includes('please check update')) {
      throw e
    }
  }

  const meta = lastUpdateCheckMeta
  if (meta?.source === 'github-api' && meta.downloadUrl) {
    lastDownloadMode = 'standalone'
    try {
      await downloadInstallerFromGithubUrl(meta.downloadUrl)
    } catch (e) {
      lastDownloadMode = null
      const msg = e instanceof Error ? e.message : String(e)
      sendUpdateProgressPayload({ percent: 0, error: msg })
      throw e
    }
    return
  }

  if (meta?.source === 'github-api' && meta.githubMissingInstaller) {
    throw new Error(
      'This release has no Windows installer (.exe) attached, or the asset URL could not be resolved. Open the Releases page and download manually.',
    )
  }

  throw new Error('No update available. Check for updates first.')
}

async function downloadInstallerFromGithubUrl(url: string): Promise<void> {
  standaloneDownloadAbort = new AbortController()
  const signal = standaloneDownloadAbort.signal
  const dest = path.join(app.getPath('temp'), `OpenClaw-Setup-update-${Date.now()}.exe`)
  try {
    sendUpdateProgressPayload({ percent: 0, transferred: 0 })
    const res = await fetch(url, {
      redirect: 'follow',
      headers: githubApiHeaders(),
      signal,
    })
    if (!res.ok) {
      throw new Error(`Download failed: HTTP ${res.status}`)
    }
    const contentLength = Number(res.headers.get('content-length') ?? '') || undefined
    const body = res.body
    if (!body) {
      throw new Error('Empty response body')
    }
    const reader = body.getReader()
    let received = 0
    const fd = fs.openSync(dest, 'w')
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value?.length) continue
        fs.writeSync(fd, value)
        received += value.byteLength
        if (contentLength && contentLength > 0) {
          sendUpdateProgressPayload({
            percent: Math.min(99, (received / contentLength) * 100),
            transferred: received,
            total: contentLength,
          })
        }
      }
    } finally {
      fs.closeSync(fd)
    }
    lastStandaloneInstallerPath = dest
    sendUpdateProgressPayload({
      percent: 100,
      completed: true,
      transferred: received,
      total: contentLength ?? received,
    })
  } catch (e) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
    } catch {
      // ignore
    }
    lastStandaloneInstallerPath = null
    throw e
  } finally {
    standaloneDownloadAbort = null
  }
}

export function cancelDownload(): void {
  cancelShellDownload()
  if (standaloneDownloadAbort) {
    standaloneDownloadAbort.abort()
    standaloneDownloadAbort = null
  }
}

/**
 * Rotate update backups — keep last MAX_BACKUPS_KEEP
 */
function pruneOldBackups(backupDir: string): void {
  try {
    if (!fs.existsSync(backupDir)) return
    const entries = fs.readdirSync(backupDir, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile() && e.name.startsWith('update-') && e.name.endsWith('.tar.gz'))
      .map((e) => ({
        name: e.name,
        path: path.join(backupDir, e.name),
        mtime: fs.statSync(path.join(backupDir, e.name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
    for (let i = MAX_BACKUPS_KEEP; i < files.length; i++) {
      try {
        fs.unlinkSync(files[i].path)
      } catch {
        // Ignore delete errors
      }
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Backup then install update (app exits)
 */
export async function installShellUpdateWithBackup(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('Updates are not available in development mode')
  }
  const backupDir = path.join(getUserDataDir(), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  writePostUpdateMarker()

  pruneOldBackups(backupDir)
  try {
    await runBackupCreateCli({
      output: path.join(backupDir, `update-${Date.now()}.tar.gz`),
      onlyConfig: false,
      verify: true,
    })
  } catch (err) {
    console.warn('[update] Pre-install backup failed:', err instanceof Error ? err.message : String(err))
    // Continue install — non-blocking
  }

  if (lastDownloadMode === 'standalone' && lastStandaloneInstallerPath && fs.existsSync(lastStandaloneInstallerPath)) {
    const installerPath = lastStandaloneInstallerPath
    const installDir = getInstallDir()
    const args = ['--updated', '--force-run', `/D=${installDir}`]
    const child = spawn(installerPath, args, { detached: true, stdio: 'ignore' })
    child.unref()
    lastStandaloneInstallerPath = null
    lastDownloadMode = null
    setImmediate(() => {
      app.quit()
    })
    return
  }

  quitAndInstallShell()
}

export function verifyBundle(): BundleVerifyResult {
  const installDir = getInstallDir()
  const versions = getAppVersions(installDir)
  const openclawDir = path.join(installDir, 'resources', 'openclaw')
  const nodeDir = path.join(installDir, 'resources', 'node')

  const nodeExists = fs.existsSync(path.join(nodeDir, 'node.exe'))
  const openclawExists = fs.existsSync(path.join(openclawDir, 'openclaw.mjs'))

  const validation = validateOpenclawResources(openclawDir)

  return {
    ok: validation.ok && nodeExists,
    nodeExists,
    openclawExists,
    missing: validation.missing,
    versions,
  }
}

export function getPrestartCheckForFrontend(): PrestartCheckFrontend {
  const result = runPrestartCheck()
  return {
    ok: result.ok,
    bundleOk: result.bundleCheck.ok,
    configExists: result.configExists,
    configParseable: result.configParseable,
    errors: result.errors,
    fixSuggestions: result.fixSuggestions,
  }
}
