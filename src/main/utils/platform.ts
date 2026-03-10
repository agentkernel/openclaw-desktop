/**
 * 平台检测 — Windows 版本与架构
 * 本项目仅支持 Windows 桌面
 */

import os from 'os'

/** 平台信息 */
export interface PlatformInfo {
  os: 'win32'
  windowsVersion: 10 | 11
  arch: 'x64' | 'arm64'
}

/**
 * 获取当前平台信息
 * 仅支持 Windows，非 Windows 时抛出
 */
export function getPlatformInfo(): PlatformInfo {
  if (process.platform !== 'win32') {
    throw new Error(`Unsupported platform: ${process.platform}. OpenClaw Desktop requires Windows.`)
  }

  const release = os.release()
  // Windows 11: build >= 22000 (e.g. 10.0.22621)
  // Windows 10: build < 22000 (e.g. 10.0.19045)
  const parts = release.split('.')
  const build = parseInt(parts[2] ?? '0', 10)
  const windowsVersion: 10 | 11 = build >= 22000 ? 11 : 10

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'

  return {
    os: 'win32',
    windowsVersion,
    arch,
  }
}
