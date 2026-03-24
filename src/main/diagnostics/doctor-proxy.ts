/**
 * Doctor proxy: run bundled `openclaw doctor`, parse stdout into items.
 * Adds desktop checks: bundle, shell/config port consistency, gateway status.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import type { DiagnosticReport, DiagnosticItem } from '../../shared/types.js'
import { getBundledNodePath, getBundledOpenClawDir, getBundledOpenClawPath, getUserDataDir } from '../utils/paths.js'
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

/** Run `openclaw doctor --non-interactive`; raw stdout/stderr */
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
      cwd: getBundledOpenClawDir(),
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
 * Parse doctor note-style output into DiagnosticItem rows.
 * Example: "Gateway\n  token missing..."
 */
function parseDoctorOutput(stdout: string, stderr: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const combined = [stdout, stderr].filter(Boolean).join('\n')
  if (!combined.trim()) return items

  // Split blocks: often "Category\n  line1" or plain lines
  const lines = combined.split(/\r?\n/).filter(Boolean)
  let currentCategory = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Likely a category title (no indent, short)
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

function normalizeAbsPathForCompare(p: string): string {
  return path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()
}

function isPathEqualOrNested(baseDir: string, candidate: string): boolean {
  const base = normalizeAbsPathForCompare(baseDir)
  const target = normalizeAbsPathForCompare(candidate)
  if (base === target) return true
  return target.startsWith(`${base}${path.sep}`.toLowerCase())
}

/** Desktop-only diagnostic rows */
function buildDesktopChecks(deps: {
  readOpenClawConfig: () => unknown
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}): DiagnosticItem[] {
  const items: DiagnosticItem[] = []
  const openclaw = deps.readOpenClawConfig() as {
    gateway?: { port?: number; mode?: string; controlUi?: { root?: unknown } }
  }
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

  const controlUiRoot = openclaw?.gateway?.controlUi?.root
  const gatewayMode = openclaw?.gateway?.mode
  if (typeof controlUiRoot === 'string' && controlUiRoot.trim() && gatewayMode !== 'remote') {
    const bundledControlUiDir = path.join(getBundledOpenClawDir(), 'dist', 'control-ui')
    const rootRaw = controlUiRoot.trim()
    let rootDir = ''
    try {
      const abs = path.resolve(rootRaw)
      const st = fs.statSync(abs)
      rootDir = st.isFile() && abs.toLowerCase().endsWith('.html') ? path.dirname(abs) : abs
    } catch {
      rootDir = ''
    }
    if (!rootDir || !isPathEqualOrNested(bundledControlUiDir, rootDir)) {
      items.push({
        id: 'desktop-control-ui-root',
        level: 'warning',
        message: `gateway.controlUi.root points outside bundled Control UI (${controlUiRoot})`,
        fix: 'Remove gateway.controlUi.root from openclaw.json and restart Gateway.',
        source: 'desktop',
      })
    }
  }

  return items
}

/** Full diagnostics → DiagnosticReport */
export async function runDiagnostics(deps: {
  readOpenClawConfig: () => unknown
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}): Promise<DiagnosticReport> {
  const runAt = new Date().toISOString()
  const items: DiagnosticItem[] = []

  // 1. Prestart
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

  // 2. Doctor CLI when bundle OK
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

  // 3. Desktop checks
  items.push(...buildDesktopChecks(deps))

  const hasError = items.some((i) => i.level === 'error')
  const ok = !hasError

  return {
    ok,
    items,
    runAt,
  }
}

/** Short summary: ok flag + first 5 error/warning items */
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
