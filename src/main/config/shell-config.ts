/**
 * 外壳配置读写
 * 路径：%APPDATA%\OpenClaw Desktop\config.json
 * 与 OpenClaw 主配置分离，存储桌面外壳自身设置
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { ShellConfig } from '../../shared/types.js'
import { APP_NAME, DEFAULT_GATEWAY_PORT, SHELL_CONFIG_FILE } from '../../shared/constants.js'

function getShellConfigPath(): string {
  return path.join(app.getPath('appData'), APP_NAME, SHELL_CONFIG_FILE)
}

/**
 * 默认外壳配置
 */
export function getDefaultShellConfig(): ShellConfig {
  return {
    closeToTray: true,
    autoStart: false,
    theme: 'system',
    lastGatewayPort: DEFAULT_GATEWAY_PORT,
    updateChannel: 'stable',
    autoCheckUpdates: true,
    windowBounds: {
      x: -1,
      y: -1,
      width: 980,
      height: 920,
      maximized: false,
    },
  }
}

/**
 * 读取外壳配置
 * - 文件不存在 → 返回默认值
 * - 解析失败（损坏）→ 返回默认值并记录警告
 */
export function readShellConfig(): ShellConfig {
  const configPath = getShellConfigPath()
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultShellConfig()
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...getDefaultShellConfig(), ...parsed } as ShellConfig
    }
    return getDefaultShellConfig()
  } catch (err) {
    console.warn(
      `[config] Shell config parse failed, using defaults: ${configPath}`,
      err instanceof Error ? err.message : String(err)
    )
    return getDefaultShellConfig()
  }
}

/**
 * 写入外壳配置
 */
export function writeShellConfig(config: ShellConfig): void {
  const configPath = getShellConfigPath()
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
