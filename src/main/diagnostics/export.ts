/**
 * 诊断包导出 — 聚合版本、配置摘要、最近日志、校验结果，脱敏后写入 JSON
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { OpenClawConfig, ShellConfig } from '../../shared/types.js'
import { getLogAggregator } from './log-aggregator.js'
import { redactConfig, redactPath, redactLogMessage } from './redact.js'
import type { PrestartCheckResult } from './prestart-check.js'
import type { AppVersionInfo, DiagnosticReport } from '../../shared/types.js'
import type { StructuredLog } from './log-aggregator.js'
import { APP_NAME } from '../../shared/constants.js'

export interface DiagnosticsExportInput {
  versions: AppVersionInfo
  openclawConfig: OpenClawConfig
  shellConfig: ShellConfig
  prestartCheck: PrestartCheckResult
  /** Doctor 诊断结果（可选，由 IPC handler 异步获取后传入） */
  doctorReport?: DiagnosticReport
}

export interface DiagnosticsExportResult {
  path: string
  checksum: string
}

function redactLogs(logs: StructuredLog[]): StructuredLog[] {
  return logs.map((log) => ({
    ...log,
    message: redactLogMessage(log.message),
  }))
}

export function exportDiagnostics(input: DiagnosticsExportInput): DiagnosticsExportResult {
  const aggregator = getLogAggregator()
  const recentLogs = redactLogs(aggregator.getRecent(1000))

  const configSummary = {
    openclaw: redactConfig(input.openclawConfig),
    shell: redactConfig(input.shellConfig),
  }

  const osInfo = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    homedir: redactPath(os.homedir()),
  }

  const meta: Record<string, unknown> = {
    app: APP_NAME,
    versions: input.versions,
    os: osInfo,
    prestartCheck: input.prestartCheck,
    checksum: '',
  }
  if (input.doctorReport != null) {
    meta.doctorReport = input.doctorReport
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    meta,
    configSummary,
    recentLogs,
  }

  const jsonWithoutChecksum = JSON.stringify(payload, null, 2)
  const checksum = crypto.createHash('sha256').update(jsonWithoutChecksum).digest('hex')
  payload.meta.checksum = checksum

  const dir = getDiagnosticsExportDir()
  fs.mkdirSync(dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `diagnostics-${timestamp}.json`
  const outPath = path.join(dir, filename)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

  return { path: outPath, checksum }
}

function getDiagnosticsExportDir(): string {
  const base = process.platform === 'win32' ? process.env.APPDATA : process.env.HOME
  const fallback = os.homedir()
  const parent = base ?? fallback
  return path.join(parent, APP_NAME)
}
