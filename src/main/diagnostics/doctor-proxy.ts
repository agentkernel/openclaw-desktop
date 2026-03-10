/**
 * Doctor 诊断代理 — 通过 bundled node.exe 执行 openclaw doctor，解析为结构化报告
 * 补充桌面版专属检查：bundle 完整性、Shell 配置一致性、Gateway 状态
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import type { DiagnosticReport, DiagnosticItem } from '../../shared/types.js'
import { getBundledNodePath, getBundledOpenClawPath, getInstallDir, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import { runPrestartCheck } from './prestart-check.js'

const DOCTOR_TIMEOUT_MS = 60_000

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

/**
 * 执行 openclaw doctor --non-interactive，返回原始输出
 */
async function runDoctorCli(): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  const args = [openclawPath, 'doctor', '--non-interactive']
  const env = {
    ...withNodeInPath(process.env, nodePath),
    OPENCLAW_STATE_DIR: getUserDataDir(),
    OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
    OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
    NODE_ENV: 'production',
  }

  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, args, {
      cwd: getInstallDir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`doctor timed out after ${DOCTOR_TIMEOUT_MS}ms`))
    }, DOCTOR_TIMEOUT_MS)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const exitCode = code ?? (signal ? 1 : 0)
      resolve({ exitCode, stdout, stderr })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/**
 * 从 doctor stdout 解析 note 格式，提取 DiagnosticItem
 * OpenClaw note 格式示例: "Gateway\n  token missing..."
 */
function parseDoctorOutput(stdout: string, stderr: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const combined = [stdout, stderr].filter(Boolean).join('\n')
  if (!combined.trim()) return items

  // 按块分割：常见模式为 "Category\n  line1\n  line2" 或纯行
  const lines = combined.split(/\r?\n/).filter(Boolean)
  let currentCategory = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 可能是 category 标题（无前导空格或较短）
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.length < 50) {
      if (currentCategory && currentLines.length > 0) {
        const message = currentLines.join(' ').trim()
        if (message) {
          items.push({
            id: `cli-${currentCategory.toLowerCase().replace(/\s+/g, '-')}`,
            level: 'warning',
            message: `${currentCategory}: ${message}`,
            fix: 'Run openclaw doctor --fix for guided repairs.',
            source: 'cli',
          })
        }
      }
      currentCategory = trimmed
      currentLines = []
    } else {
      currentLines.push(trimmed)
    }
  }

  if (currentCategory && currentLines.length > 0) {
    const message = currentLines.join(' ').trim()
    if (message) {
      items.push({
        id: `cli-${currentCategory.toLowerCase().replace(/\s+/g, '-')}`,
        level: 'warning',
        message: `${currentCategory}: ${message}`,
        fix: 'Run openclaw doctor --fix for guided repairs.',
        source: 'cli',
      })
    }
  }

  return items
}

/**
 * 构建桌面版专属检查项
 */
function buildDesktopChecks(deps: {
  readOpenClawConfig: () => { gateway?: { port?: number } }
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const openclaw = deps.readOpenClawConfig()
  const shell = deps.readShellConfig()
  const gw = deps.gatewayStatus()

  const configPort = openclaw?.gateway?.port
  const shellPort = shell?.lastGatewayPort

  if (configPort != null && shellPort != null && configPort !== shellPort) {
    items.push({
      id: 'desktop-shell-consistency',
      level: 'warning',
      message: `Shell lastGatewayPort (${shellPort}) differs from openclaw.json gateway.port (${configPort})`,
      fix: 'Restart Gateway or restart the app to sync.',
      source: 'desktop',
    })
  }

  if (!gw.running && gw.status !== 'stopped') {
    items.push({
      id: 'desktop-gateway-health',
      level: 'info',
      message: `Gateway status: ${gw.status}`,
      fix: gw.status === 'error' ? 'Check logs and restart Gateway.' : undefined,
      source: 'desktop',
    })
  } else if (gw.running) {
    items.push({
      id: 'desktop-gateway-health',
      level: 'pass',
      message: 'Gateway is running',
      source: 'desktop',
    })
  }

  return items
}

/**
 * 运行完整诊断，返回结构化 DiagnosticReport
 */
export async function runDiagnostics(deps: {
  readOpenClawConfig: () => { gateway?: { port?: number } }
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}): Promise<DiagnosticReport> {
  const runAt = new Date().toISOString()
  const items: DiagnosticItem[] = []

  // 1. Prestart 检查
  const prestart = runPrestartCheck()
  if (!prestart.bundleCheck.ok) {
    items.push({
      id: 'prestart-bundle',
      level: 'error',
      message: `Bundle incomplete: ${prestart.bundleCheck.missing.join(', ')}`,
      fix: prestart.fixSuggestions[0] ?? 'Reinstall the application.',
      source: 'prestart',
    })
  } else {
    items.push({
      id: 'prestart-bundle',
      level: 'pass',
      message: 'Bundle check passed',
      source: 'prestart',
    })
  }

  if (!prestart.configExists) {
    items.push({
      id: 'prestart-config',
      level: 'info',
      message: 'Config not found (wizard will run)',
      source: 'prestart',
    })
  } else if (!prestart.configParseable) {
    items.push({
      id: 'prestart-config',
      level: 'error',
      message: prestart.errors[0] ?? 'openclaw.json parse error',
      fix: prestart.fixSuggestions[0],
      source: 'prestart',
    })
  } else {
    items.push({
      id: 'prestart-config',
      level: 'pass',
      message: 'Config exists and parseable',
      source: 'prestart',
    })
  }

  // 2. 若 bundle 存在，执行 doctor CLI
  if (prestart.bundleCheck.ok) {
    try {
      const { exitCode, stdout, stderr } = await runDoctorCli()
      if (exitCode === 0) {
        items.push({
          id: 'cli-doctor',
          level: 'pass',
          message: 'OpenClaw doctor completed successfully',
          source: 'cli',
        })
      } else {
        const parsed = parseDoctorOutput(stdout, stderr)
        if (parsed.length > 0) {
          items.push(...parsed)
        } else {
          items.push({
            id: 'cli-doctor',
            level: 'warning',
            message: `Doctor exited with code ${exitCode}`,
            fix: 'Run openclaw doctor --fix in terminal for details.',
            source: 'cli',
          })
        }
      }
    } catch (err) {
      items.push({
        id: 'cli-doctor',
        level: 'error',
        message: err instanceof Error ? err.message : String(err),
        fix: 'Ensure bundled OpenClaw is available. Run prepare-bundle.',
        source: 'cli',
      })
    }
  }

  // 3. 桌面版专属检查
  items.push(...buildDesktopChecks(deps))

  const hasError = items.some((i) => i.level === 'error')
  const ok = !hasError

  return {
    ok,
    items,
    runAt,
  }
}

/**
 * 返回轻量摘要：ok + 前 5 条 error/warning
 */
export function getDiagnosticsSummary(report: DiagnosticReport): {
  ok: boolean
  summary: string
  topIssues: DiagnosticItem[]
} {
  const topIssues = report.items
    .filter((i) => i.level === 'error' || i.level === 'warning')
    .slice(0, 5)
  const summary =
    topIssues.length === 0
      ? 'All checks passed'
      : `${topIssues.length} issue(s) found. Run full diagnostics for details.`
  return {
    ok: report.ok,
    summary,
    topIssues,
  }
}
