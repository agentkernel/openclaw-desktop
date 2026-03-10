/**
 * OpenClaw 主配置读写
 * 路径：%USERPROFILE%\.openclaw\openclaw.json（JSON5 格式）
 * 参考：OpenClaw config/io.ts loadConfig 流程
 */

import fs from 'node:fs'
import path from 'node:path'
import JSON5 from 'json5'
import type { OpenClawConfig } from '../../shared/types.js'
import { getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

function getOpenClawConfigPath(): string {
  return path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
}

/**
 * 读取 OpenClaw 主配置
 * - 文件不存在 → 返回 {}
 * - 解析失败（损坏）→ 返回 {} 并记录警告
 */
export function readOpenClawConfig(): OpenClawConfig {
  const configPath = getOpenClawConfigPath()
  try {
    if (!fs.existsSync(configPath)) {
      return {}
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON5.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as OpenClawConfig
    }
    return {}
  } catch (err) {
    console.warn(
      `[config] OpenClaw config parse failed, using defaults: ${configPath}`,
      err instanceof Error ? err.message : String(err)
    )
    return {}
  }
}

/**
 * 写入 OpenClaw 主配置
 * 使用标准 JSON 格式输出（便于工具兼容）
 */
export function writeOpenClawConfig(config: OpenClawConfig): void {
  const configPath = getOpenClawConfigPath()
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

/**
 * 检查 OpenClaw 配置文件是否存在
 */
export function openclawConfigExists(): boolean {
  return fs.existsSync(getOpenClawConfigPath())
}
