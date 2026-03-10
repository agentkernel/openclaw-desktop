/**
 * 安装后校验 — 检测 marker、执行 doctor+bundle 校验、写入结果
 * 供 Update Center 展示回滚指引与诊断包导出入口
 */

import fs from 'node:fs'
import path from 'node:path'
import type { DiagnosticReport } from '../../shared/types.js'
import { runDiagnostics } from '../diagnostics/doctor-proxy.js'
import { getUserDataDir } from '../utils/paths.js'

const MARKER_FILE = '.post-update-pending'
const RESULT_FILE = '.post-update-result.json'

const ROLLBACK_GUIDANCE = `若更新后应用无法正常使用：
1. 使用「导出诊断包」保存当前状态，便于排查
2. 从备份恢复：打开备份目录（%USERPROFILE%\\.openclaw\\backups），使用 openclaw backup restore 命令恢复
3. 或从 GitHub Releases 下载上一版本安装包重新安装`

export interface PostUpdateValidationDeps {
  readOpenClawConfig: () => { gateway?: { port?: number } }
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}

export interface PostUpdateValidationResult {
  ran: boolean
  ok: boolean
  report?: DiagnosticReport
  rollbackGuidance: string
}

function getMarkerPath(): string {
  return path.join(getUserDataDir(), MARKER_FILE)
}

function getResultPath(): string {
  return path.join(getUserDataDir(), RESULT_FILE)
}

/**
 * 安装前调用：写入 marker，表示即将执行更新安装
 */
export function writePostUpdateMarker(): void {
  try {
    const markerPath = getMarkerPath()
    const dir = path.dirname(markerPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(markerPath, JSON.stringify({ at: Date.now() }), 'utf-8')
  } catch (err) {
    console.warn('[post-update] Failed to write marker:', err instanceof Error ? err.message : String(err))
  }
}

/**
 * 安装后启动时调用：若存在 marker，执行 doctor+bundle 校验并写入结果
 */
export async function runPostUpdateValidationIfNeeded(
  deps: PostUpdateValidationDeps,
): Promise<void> {
  const markerPath = getMarkerPath()
  if (!fs.existsSync(markerPath)) {
    return
  }

  try {
    fs.unlinkSync(markerPath)
  } catch {
    // 忽略删除失败
  }

  const resultPath = getResultPath()
  try {
    const report = await runDiagnostics({
      readOpenClawConfig: deps.readOpenClawConfig,
      readShellConfig: deps.readShellConfig,
      gatewayStatus: deps.gatewayStatus,
    })
    const result: PostUpdateValidationResult = {
      ran: true,
      ok: report.ok,
      report,
      rollbackGuidance: ROLLBACK_GUIDANCE,
    }
    const dir = path.dirname(resultPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const result: PostUpdateValidationResult = {
      ran: true,
      ok: false,
      rollbackGuidance: ROLLBACK_GUIDANCE,
    }
    try {
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8')
    } catch {
      console.warn('[post-update] Failed to write result:', message)
    }
  }
}

/**
 * 供 IPC 使用：读取并消费安装后校验结果（一次性）
 */
export function readAndConsumePostUpdateResult(): PostUpdateValidationResult | null {
  const resultPath = getResultPath()
  if (!fs.existsSync(resultPath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(resultPath, 'utf-8')
    fs.unlinkSync(resultPath)
    const parsed = JSON.parse(raw) as PostUpdateValidationResult
    return {
      ran: parsed.ran ?? true,
      ok: parsed.ok ?? false,
      report: parsed.report,
      rollbackGuidance: parsed.rollbackGuidance ?? ROLLBACK_GUIDANCE,
    }
  } catch {
    try { fs.unlinkSync(resultPath) } catch { /* ignore */ }
    return null
  }
}
