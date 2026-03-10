/**
 * Backup/Restore 代理 — 通过 bundled node.exe 执行 openclaw backup create/verify
 * 兼容原生 backup 格式，返回文件路径和资产列表
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import {
  getBundledNodePath,
  getBundledOpenClawPath,
  getInstallDir,
  getUserDataDir,
} from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

const BACKUP_TIMEOUT_MS = 120_000

export interface BackupCreateOptions {
  output?: string
  includeWorkspace?: boolean
  onlyConfig?: boolean
  verify?: boolean
}

export interface BackupAsset {
  kind: string
  displayPath: string
}

export interface BackupCreateResult {
  archivePath: string
  assets: BackupAsset[]
  skipped?: Array<{ kind: string; displayPath: string; reason: string }>
  verified?: boolean
}

export interface BackupVerifyResult {
  ok: boolean
  archivePath?: string
  message?: string
}

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

function buildCliEnv(): NodeJS.ProcessEnv {
  const nodePath = getBundledNodePath()
  return {
    ...withNodeInPath(process.env, nodePath),
    OPENCLAW_STATE_DIR: getUserDataDir(),
    OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
    OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
    NODE_ENV: 'production',
  }
}

function runBackupCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  const fullArgs = [openclawPath, 'backup', ...args]
  const env = buildCliEnv()

  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, fullArgs, {
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
      reject(new Error(`backup CLI timed out after ${BACKUP_TIMEOUT_MS}ms`))
    }, BACKUP_TIMEOUT_MS)

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

function parseJsonFromStdout(stdout: string): unknown {
  const trimmed = stdout.trim()
  const jsonStart = trimmed.indexOf('{')
  if (jsonStart < 0) {
    throw new Error('No JSON output in backup stdout')
  }
  const jsonStr = trimmed.slice(jsonStart)
  try {
    return JSON.parse(jsonStr) as unknown
  } catch (err) {
    throw new Error(`Failed to parse backup JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * 执行 openclaw backup create，返回备份文件路径和资产列表
 */
export async function runBackupCreateCli(opts: BackupCreateOptions = {}): Promise<BackupCreateResult> {
  const args: string[] = ['create', '--json']
  if (opts.output?.trim()) {
    args.push('--output', opts.output.trim())
  }
  if (opts.onlyConfig) {
    args.push('--only-config')
  }
  if (opts.includeWorkspace === false) {
    args.push('--no-include-workspace')
  }
  if (opts.verify) {
    args.push('--verify')
  }

  const { exitCode, stdout, stderr } = await runBackupCli(args)
  if (exitCode !== 0) {
    const message = [stderr, stdout].filter(Boolean).join('\n').trim() || `backup create exited with code ${exitCode}`
    throw new Error(message)
  }

  const raw = parseJsonFromStdout(stdout) as Record<string, unknown>
  const archivePath = typeof raw.archivePath === 'string' ? raw.archivePath : ''
  const assetsRaw = Array.isArray(raw.assets) ? raw.assets : []
  const assets: BackupAsset[] = assetsRaw.map((a: unknown) => {
    const obj = a && typeof a === 'object' ? (a as Record<string, unknown>) : {}
    return {
      kind: typeof obj.kind === 'string' ? obj.kind : 'unknown',
      displayPath: typeof obj.displayPath === 'string' ? obj.displayPath : String(obj.sourcePath ?? ''),
    }
  })
  const skippedRaw = Array.isArray(raw.skipped) ? raw.skipped : []
  const skipped = skippedRaw.map((s: unknown) => {
    const obj = s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
    return {
      kind: typeof obj.kind === 'string' ? obj.kind : 'unknown',
      displayPath: typeof obj.displayPath === 'string' ? obj.displayPath : String(obj.sourcePath ?? ''),
      reason: typeof obj.reason === 'string' ? obj.reason : 'unknown',
    }
  })
  const verified = raw.verified === true

  return {
    archivePath,
    assets,
    skipped: skipped.length > 0 ? skipped : undefined,
    verified,
  }
}

/**
 * 执行 openclaw backup verify，校验备份完整性
 */
export async function runBackupVerifyCli(archivePath: string): Promise<BackupVerifyResult> {
  const resolved = path.resolve(archivePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Backup archive not found: ${resolved}`)
  }

  const args = ['verify', resolved, '--json']
  const { exitCode, stdout, stderr } = await runBackupCli(args)

  if (exitCode !== 0) {
    const message = [stderr, stdout].filter(Boolean).join('\n').trim() || `backup verify exited with code ${exitCode}`
    return { ok: false, archivePath: resolved, message }
  }

  try {
    const raw = parseJsonFromStdout(stdout) as Record<string, unknown>
    const ok = raw.ok === true
    return {
      ok,
      archivePath: resolved,
      message: typeof raw.message === 'string' ? raw.message : 'Verification completed',
    }
  } catch {
    return { ok: exitCode === 0, archivePath: resolved, message: stdout.trim() || stderr.trim() }
  }
}
