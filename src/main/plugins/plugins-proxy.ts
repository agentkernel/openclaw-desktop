/**
 * Plugins 状态代理 — 通过 bundled node.exe 执行 openclaw plugins CLI
 * 获取插件清单，支持 enable/disable/install/uninstall
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import type { PluginInfo } from '../../shared/types.js'
import { getBundledNodePath, getBundledOpenClawPath, getInstallDir, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

const PLUGINS_TIMEOUT_MS = 60_000

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

function runPluginsCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  const fullArgs = [openclawPath, 'plugins', ...args]
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
      reject(new Error(`plugins CLI timed out after ${PLUGINS_TIMEOUT_MS}ms`))
    }, PLUGINS_TIMEOUT_MS)

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

function mapCliPluginToInfo(raw: Record<string, unknown>): PluginInfo {
  const status = raw.status === 'loaded' || raw.status === 'disabled' || raw.status === 'error'
    ? raw.status
    : 'disabled'
  return {
    id: String(raw.id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : undefined,
    status,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    origin: typeof raw.origin === 'string' ? raw.origin : undefined,
    version: typeof raw.version === 'string' ? raw.version : undefined,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  }
}

/**
 * 获取插件清单 — 执行 openclaw plugins list --json
 */
export async function listPluginsWithCli(): Promise<{ plugins: PluginInfo[]; workspaceDir?: string }> {
  try {
    const { exitCode, stdout } = await runPluginsCli(['list', '--json'])
    if (exitCode !== 0) {
      return { plugins: [] }
    }
    const parsed = JSON.parse(stdout || '{}') as { plugins?: unknown[]; workspaceDir?: string }
    const rawPlugins = Array.isArray(parsed.plugins) ? parsed.plugins : []
    const plugins = rawPlugins
      .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
      .map(mapCliPluginToInfo)
      .filter((p) => p.id)
    return { plugins, workspaceDir: parsed.workspaceDir }
  } catch {
    return { plugins: [] }
  }
}

/**
 * 启用插件 — openclaw plugins enable <id>
 */
export async function enablePlugin(id: string): Promise<{ ok: boolean; message?: string }> {
  const { exitCode, stderr } = await runPluginsCli(['enable', id])
  return {
    ok: exitCode === 0,
    message: exitCode !== 0 ? stderr.trim() || `Exit code ${exitCode}` : undefined,
  }
}

/**
 * 禁用插件 — openclaw plugins disable <id>
 */
export async function disablePlugin(id: string): Promise<{ ok: boolean; message?: string }> {
  const { exitCode, stderr } = await runPluginsCli(['disable', id])
  return {
    ok: exitCode === 0,
    message: exitCode !== 0 ? stderr.trim() || `Exit code ${exitCode}` : undefined,
  }
}

/**
 * 切换插件启用状态
 */
export async function togglePlugin(id: string, enabled: boolean): Promise<{ ok: boolean; message?: string }> {
  return enabled ? enablePlugin(id) : disablePlugin(id)
}

/**
 * 安装插件 — openclaw plugins install <spec>
 * spec 可为本地路径、archive 或 npm 包名
 */
export async function installPlugin(spec: string): Promise<{ ok: boolean; pluginId?: string; message?: string }> {
  const trimmed = spec?.trim()
  if (!trimmed) {
    return { ok: false, message: 'Install spec is required' }
  }
  try {
    const { exitCode, stdout, stderr } = await runPluginsCli(['install', trimmed])
    const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
    if (exitCode !== 0) {
      return { ok: false, message: combined || `Exit code ${exitCode}` }
    }
    // 尝试从输出解析 "Installed plugin: <id>"
    const match = combined.match(/Installed plugin:\s*([^\s]+)/i)
    const pluginId = match?.[1]
    return { ok: true, pluginId, message: combined || undefined }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 卸载插件 — openclaw plugins uninstall <id> --force
 */
export async function uninstallPlugin(
  id: string,
  opts?: { keepFiles?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  const trimmed = id?.trim()
  if (!trimmed) {
    return { ok: false, message: 'Plugin id is required' }
  }
  const args = ['uninstall', trimmed, '--force']
  if (opts?.keepFiles) {
    args.push('--keep-files')
  }
  try {
    const { exitCode, stdout, stderr } = await runPluginsCli(args)
    const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
    if (exitCode !== 0) {
      return { ok: false, message: combined || `Exit code ${exitCode}` }
    }
    return { ok: true, message: combined || undefined }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
