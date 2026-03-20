/**
 * Update service: prefer electron-updater, fall back to GitHub API.
 * Bundle verify, pre-start check, backup before install.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
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
} from './auto-updater-integration.js'
import { runBackupCreateCli } from '../backup/index.js'
import { getUserDataDir } from '../utils/paths.js'
import { writePostUpdateMarker } from './post-update-validation.js'

const GITHUB_REPO = 'agentkernel/openclaw-desktop'
const MAX_BACKUPS_KEEP = 1
const GITHUB_API_BASE = 'https://api.github.com'

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
  return tag.replace(/^v/, '')
}

function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0
    const lv = l[i] ?? 0
    if (lv > cv) return true
    if (lv < cv) return false
  }
  return false
}

async function checkForUpdatesViaGitHub(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`,
    {
      headers: { Accept: 'application/vnd.github.v3+json' },
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
  const hasUpdate = isNewerVersion(currentVersion, latestVersion)
  const setupAsset = release.assets?.find(
    (a) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
  )
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

export async function checkForUpdates(
  readShellConfig: () => { updateChannel?: string },
): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const result = await checkForUpdatesWithAutoUpdater(readShellConfig)
    if (result !== null) {
      return result
    }
  } catch {
    // Fall back to GitHub API
  }
  try {
    return await checkForUpdatesViaGitHub()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { hasUpdate: false, currentVersion, error: 'Request timed out. Check your network connection.' }
    }
    return { hasUpdate: false, currentVersion, error: msg }
  }
}

export async function downloadUpdate(): Promise<void> {
  await downloadShellUpdate()
}

export function cancelDownload(): void {
  cancelShellDownload()
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
