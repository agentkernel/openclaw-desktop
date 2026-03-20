/**
 * Auto-start at login — tied to ShellConfig.autoStart.
 * Electron setLoginItemSettings / getLoginItemSettings.
 * Windows: HKCU ... Run; macOS: Launch Agent.
 */

import { app } from 'electron'
import { logInfo, logWarn } from '../utils/logger.js'

const SUPPORTED_PLATFORMS = ['win32', 'darwin']

function isSupported(): boolean {
  return SUPPORTED_PLATFORMS.includes(process.platform)
}

/**
 * Apply ShellConfig.autoStart to the OS login item
 */
export function syncLoginItemToSystem(autoStart: boolean): void {
  if (!isSupported()) {
    return
  }
  try {
    app.setLoginItemSettings({ openAtLogin: autoStart })
    logInfo(`[login-item] Synced openAtLogin=${autoStart}`)
  } catch (err) {
    logWarn(
      `[login-item] setLoginItemSettings failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Read whether the app is set to open at login
 */
export function getLoginItemOpenAtLogin(): boolean {
  if (!isSupported()) {
    return false
  }
  try {
    const settings = app.getLoginItemSettings()
    return Boolean(settings.openAtLogin)
  } catch (err) {
    logWarn(
      `[login-item] getLoginItemSettings failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return false
  }
}

/**
 * Remove login item (uninstaller or --clear-login-item)
 */
export function clearLoginItem(): void {
  if (!isSupported()) {
    return
  }
  try {
    app.setLoginItemSettings({ openAtLogin: false })
    logInfo('[login-item] Cleared login item')
  } catch (err) {
    logWarn(
      `[login-item] clearLoginItem failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
