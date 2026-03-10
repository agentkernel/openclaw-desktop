import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { GatewayStatus, GatewayStatusValue } from '../../shared/types.js'
import { DEFAULT_GATEWAY_PORT } from '../../shared/constants.js'
import { getBundledNodePath, getBundledOpenClawPath, getInstallDir, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import { logInfo, logWarn } from '../utils/logger.js'

export interface GatewayLaunchOptions {
  port?: number
  bind?: 'loopback' | 'lan' | 'auto'
  /** 认证 token，传递 --token 和 --auth token 与原生 gateway run 对齐 */
  token?: string
  /** 端口冲突时传递 --force，由用户配置 gateway.forcePortOnConflict 控制 */
  force?: boolean
}

export interface GatewayLogEvent {
  stream: 'stdout' | 'stderr'
  message: string
}

export interface GatewayLaunchSpec {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export interface GatewayProcessManagerOptions {
  onLog?: (event: GatewayLogEvent) => void
  onStatusChange?: (status: GatewayStatus) => void
  healthCheckIntervalMs?: number
  maxAutoRestarts?: number
  restartWindowMs?: number
}

export interface GatewayHealthCheckResult {
  ok: boolean
  statusCode?: number
  details?: string
}

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

export function createGatewayLaunchSpec(options: GatewayLaunchOptions = {}): GatewayLaunchSpec {
  const port = options.port ?? DEFAULT_GATEWAY_PORT
  const bind = options.bind ?? 'loopback'
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  const args: string[] = [openclawPath, 'gateway', 'run', '--allow-unconfigured', '--bind', bind, '--port', String(port)]
  if (options.token?.trim()) {
    args.push('--token', options.token.trim(), '--auth', 'token')
  }
  if (options.force) {
    args.push('--force')
  }

  return {
    command: nodePath,
    args,
    cwd: getInstallDir(),
    env: {
      ...withNodeInPath(process.env, nodePath),
      OPENCLAW_STATE_DIR: getUserDataDir(),
      OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
      OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
      NODE_ENV: 'production',
    },
  }
}

function ensureGatewayResources(): { nodePath: string; openclawPath: string } {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw entry not found: ${openclawPath}`)
  }
  return { nodePath, openclawPath }
}

function splitLogLines(raw: Buffer): string[] {
  return raw
    .toString('utf-8')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

export class GatewayProcessManager {
  private child: ChildProcessWithoutNullStreams | null = null
  private stopping = false
  private restarting = false
  private startedAt = 0
  private currentPort = DEFAULT_GATEWAY_PORT
  private statusValue: GatewayStatusValue = 'stopped'
  private lastLaunchOptions: GatewayLaunchOptions = {}
  private healthCheckTimer: NodeJS.Timeout | null = null
  private healthCheckInFlight = false
  private recentRestarts: number[] = []
  private readonly healthCheckIntervalMs: number
  private readonly maxAutoRestarts: number
  private readonly restartWindowMs: number
  private readonly statusListeners = new Set<(status: GatewayStatus) => void>()
  private readonly logListeners = new Set<(event: GatewayLogEvent) => void>()
  private readonly onLog?: (event: GatewayLogEvent) => void
  private readonly onStatusChange?: (status: GatewayStatus) => void
  private waitForReadyAbort: AbortController | null = null

  constructor(options: GatewayProcessManagerOptions = {}) {
    this.onLog = options.onLog
    this.onStatusChange = options.onStatusChange
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 10_000
    this.maxAutoRestarts = options.maxAutoRestarts ?? 3
    this.restartWindowMs = options.restartWindowMs ?? 5 * 60_000
  }

  onGatewayStatusChange(listener: (status: GatewayStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onGatewayLog(listener: (event: GatewayLogEvent) => void): () => void {
    this.logListeners.add(listener)
    return () => this.logListeners.delete(listener)
  }

  getStatus(): GatewayStatus {
    const running =
      this.statusValue === 'running' || Boolean(this.child && !this.child.killed && this.statusValue !== 'stopped')
    const uptime = running && this.startedAt > 0 ? Date.now() - this.startedAt : 0

    return {
      running,
      port: this.currentPort,
      pid: this.child?.pid ?? null,
      uptime,
      status: this.statusValue,
    }
  }

  async start(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    if (this.child && !this.child.killed) {
      return this.getStatus()
    }

    try {
      const { nodePath, openclawPath } = ensureGatewayResources()
      logInfo(`[gateway] resources ok: node=${nodePath} openclaw=${openclawPath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.statusValue = 'error'
      this.notifyStatusChange()
      this.emitLog('stderr', `[gateway] ${message}`)
      throw error
    }

    const port = options.port ?? DEFAULT_GATEWAY_PORT
    this.currentPort = port
    this.lastLaunchOptions = { ...options, port }

    const existing = await this.checkGatewayHealth(port)
    if (existing.ok) {
      this.startedAt = Date.now()
      this.statusValue = 'running'
      this.notifyStatusChange()
      return this.getStatus()
    }

    const launchSpec = createGatewayLaunchSpec(options)
    logInfo(`[gateway] spawn: ${launchSpec.command} ${launchSpec.args.join(' ')}`)
    this.statusValue = 'starting'
    this.notifyStatusChange()

    const spawnOptions: SpawnOptionsWithoutStdio = {
      cwd: launchSpec.cwd,
      env: launchSpec.env,
      windowsHide: true,
      stdio: 'pipe',
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(launchSpec.command, launchSpec.args, spawnOptions)
      this.child = child

      child.once('error', (error) => {
        this.child = null
        this.statusValue = 'error'
        this.notifyStatusChange()
        reject(error)
      })

      child.once('spawn', () => {
        this.startedAt = Date.now()
        this.stopping = false
        this.restarting = false
        this.statusValue = 'starting'
        this.startHealthCheckLoop()
        this.notifyStatusChange()
        resolve()
        void this.waitForGatewayReady()
      })

      child.stdout.on('data', (chunk: Buffer) => {
        this.emitLogs('stdout', chunk)
      })

      child.stderr.on('data', (chunk: Buffer) => {
        this.emitLogs('stderr', chunk)
      })

      child.once('exit', (code, signal) => {
        this.child = null
        this.startedAt = 0
        this.waitForReadyAbort?.abort()
        this.waitForReadyAbort = null
        this.stopHealthCheckLoop()
        this.statusValue = this.stopping ? 'stopped' : code === 0 ? 'stopped' : 'error'
        this.notifyStatusChange()
    this.emitLog('stderr', `[gateway] exited (code=${String(code)}, signal=${String(signal)})`)

        if (!this.stopping && this.statusValue === 'error') {
          void this.tryAutoRestart('process-exit')
        }
      })
    })

    return this.getStatus()
  }

  async stop(timeoutMs = 5000): Promise<GatewayStatus> {
    this.waitForReadyAbort?.abort()
    this.waitForReadyAbort = null
    this.stopHealthCheckLoop()
    this.healthCheckInFlight = false
    this.recentRestarts = []

    if (!this.child) {
      this.statusValue = 'stopped'
      this.notifyStatusChange()
      return this.getStatus()
    }

    const child = this.child
    this.stopping = true
    this.statusValue = 'stopped'
    this.notifyStatusChange()

    await new Promise<void>((resolve) => {
      let settled = false

      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }

      child.once('exit', () => finish())

      try {
        child.kill('SIGTERM')
      } catch {
        finish()
        return
      }

      setTimeout(() => {
        if (!settled && !child.killed) {
          try {
            child.kill('SIGKILL')
          } catch {
            // no-op: process may already be gone
          }
        }
        finish()
      }, timeoutMs)
    })

    return this.getStatus()
  }

  async restart(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    await this.stop()
    return this.start(options)
  }

  /**
   * 等待 Gateway 真正开始监听（GET /health 返回 200）后再将状态设为 running，
   * 与 OpenClaw 官方行为一致：仅当端口可访问时才视为就绪。
   */
  private async waitForGatewayReady(): Promise<void> {
    this.waitForReadyAbort?.abort()
    this.waitForReadyAbort = new AbortController()
    const signal = this.waitForReadyAbort.signal
    const pollIntervalMs = 600
    const warnAfterMs = 300_000
    const deadline = Date.now() + warnAfterMs
    let warned = false
    while (!signal.aborted && this.child && !this.child.killed && this.statusValue === 'starting') {
      if (!warned && Date.now() >= deadline) {
        this.emitLog('stderr', '[gateway] wait for ready timed out')
        warned = true
      }
      const result = await this.checkGatewayHealth(this.currentPort)
      if (result.ok) {
        this.statusValue = 'running'
        this.notifyStatusChange()
        return
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }
  }

  private startHealthCheckLoop(): void {
    this.stopHealthCheckLoop()
    this.healthCheckTimer = setInterval(() => {
      void this.runHealthCheck()
    }, this.healthCheckIntervalMs)
  }

  private stopHealthCheckLoop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  private async runHealthCheck(): Promise<void> {
    if (this.stopping || this.restarting || this.statusValue !== 'running' || !this.child) {
      return
    }
    if (this.healthCheckInFlight) {
      return
    }
    this.healthCheckInFlight = true
    try {
      const result = await this.checkGatewayHealth(this.currentPort)
      if (!result.ok) {
        this.emitLog('stderr', `[gateway] health check failed (${result.details ?? 'unknown'})`)
        await this.tryAutoRestart('health-check')
      }
    } finally {
      this.healthCheckInFlight = false
    }
  }

  private async checkGatewayHealth(port: number): Promise<GatewayHealthCheckResult> {
    const endpoints = ['/health', '/api/health', '/']
    let lastResult: GatewayHealthCheckResult | null = null
    for (const endpoint of endpoints) {
      const result = await this.checkGatewayHealthEndpoint(port, endpoint)
      if (result.ok) {
        return result
      }
      lastResult = result
    }
    return lastResult ?? { ok: false, details: 'unknown' }
  }

  private async checkGatewayHealthEndpoint(port: number, endpoint: string): Promise<GatewayHealthCheckResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    try {
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
        method: 'GET',
        signal: controller.signal,
      })
      // Any HTTP response means the TCP port is open and the server is listening.
      // We do NOT require 2xx because:
      //  - /health and /api/health may return 404 (not implemented in all gateway versions)
      //  - / may return 403 when accessed without auth token
      // Only a network-level failure (ECONNREFUSED, timeout, etc.) means the gateway is down.
      return { ok: true, statusCode: response.status }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      return { ok: false, details }
    } finally {
      clearTimeout(timeout)
    }
  }

  private pruneRestartHistory(now: number): void {
    this.recentRestarts = this.recentRestarts.filter((timestamp) => now - timestamp <= this.restartWindowMs)
  }

  private async tryAutoRestart(reason: 'process-exit' | 'health-check'): Promise<void> {
    if (this.stopping || this.restarting) {
      return
    }

    const now = Date.now()
    this.pruneRestartHistory(now)
    if (this.recentRestarts.length >= this.maxAutoRestarts) {
      this.statusValue = 'error'
      this.notifyStatusChange()
      this.stopHealthCheckLoop()
      this.emitLog(
        'stderr',
        `[gateway] auto restart disabled: reached ${this.maxAutoRestarts} restarts within ${Math.floor(this.restartWindowMs / 60_000)} minutes (${reason})`,
      )
      return
    }

    this.restarting = true
    this.recentRestarts.push(now)
    const attempt = this.recentRestarts.length
    this.emitLog(
      'stderr',
      `[gateway] auto restart #${attempt}/${this.maxAutoRestarts} triggered by ${reason}`,
    )
    try {
      await this.restart(this.lastLaunchOptions)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.statusValue = 'error'
      this.notifyStatusChange()
      this.emitLog('stderr', `[gateway] auto restart failed: ${message}`)
    } finally {
      this.restarting = false
    }
  }

  private emitLogs(stream: 'stdout' | 'stderr', raw: Buffer): void {
    for (const line of splitLogLines(raw)) {
      if (stream === 'stdout') {
        this.tryMarkReadyFromLog(line)
      }
      this.emitLog(stream, line)
    }
  }

  private tryMarkReadyFromLog(line: string): void {
    if (this.statusValue !== 'starting') return
    const match = line.match(/\blistening on ws:\/\/127\.0\.0\.1:(\d+)/)
    if (!match) return
    const port = Number(match[1])
    if (Number.isFinite(port) && port > 0) {
      this.currentPort = port
    }
    this.statusValue = 'running'
    this.notifyStatusChange()
  }

  private emitLog(stream: 'stdout' | 'stderr', message: string): void {
    const line = `[gateway:${stream}] ${message}`
    try {
      if (stream === 'stderr') {
        logWarn(line)
      } else {
        logInfo(line)
      }
    } catch {
      // EPIPE / broken pipe — output pipe closed, safe to ignore
    }
    this.onLog?.({ stream, message })
    this.logListeners.forEach((listener) => listener({ stream, message }))
  }

  private notifyStatusChange(): void {
    const status = this.getStatus()
    this.onStatusChange?.(status)
    this.statusListeners.forEach((listener) => listener(status))
  }
}
