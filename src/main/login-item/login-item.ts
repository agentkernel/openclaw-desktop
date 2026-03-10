/**
 * 开机自启 — 与 ShellConfig.autoStart 联动
 * 使用 Electron app.setLoginItemSettings / getLoginItemSettings
 * Windows: 注册表 HKCU\...\Run
 * macOS: Launch Agent
 */

import { app } from 'electron'
import { logInfo, logWarn } from '../utils/logger.js'

const SUPPORTED_PLATFORMS = ['win32', 'darwin']

function isSupported(): boolean {
  return SUPPORTED_PLATFORMS.includes(process.platform)
}

/**
 * 将 autoStart 配置同步到系统登录项
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
 * 获取当前系统登录项状态（openAtLogin）
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
 * 清除登录项（供卸载脚本或 --clear-login-item 调用）
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
