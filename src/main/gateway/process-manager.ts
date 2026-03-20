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
  /** Auth token; passed as --token / --auth token (aligned with gateway run) */
  token?: string
  /** Pass --force on port conflict when gateway.forcePortOnConflict is set */
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
  healthCheckFailureThreshold?: number
  maxAutoRestarts?: number
  restartWindowMs?: number
}

export interface GatewayHealthCheckResult {
  ok: boolean
  statusCode?: number
  details?: string
}

/**
 * Kuae Coding Plan (OpenAI-compatible) API hosts. Some local HTTPS proxies break TLS to these
 * hosts while direct connections work. Merge the following into the gateway child NO_PROXY so
 * Kuae LLM traffic bypasses the proxy; other traffic still follows HTTP(S)_PROXY.
 * Set OPENCLAW_SKIP_KUAE_NO_PROXY=1 to disable (debugging).
 */
const KUAE_DIRECT_NO_PROXY_HOSTS = ['coding-plan-endpoint.kuaecloud.net', '.kuaecloud.net'] as const

function mergeNoProxyList(existing: string | undefined, additions: readonly string[]): string {
  const parts = new Set<string>()
  for (const segment of (existing ?? '').split(/[\s,]+/)) {
    const t = segment.trim()
    if (t) parts.add(t)
  }
  for (const a of additions) {
    parts.add(a)
  }
  return [...parts].join(',')
}

/** Append Kuae hosts to NO_PROXY / no_proxy while keeping HTTPS_PROXY etc. (Node fetch/undici). */
function applyKuaeNoProxyBypass(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.OPENCLAW_SKIP_KUAE_NO_PROXY === '1' || env.OPENCLAW_SKIP_KUAE_NO_PROXY === 'true') {
    return env
  }
  const merged = mergeNoProxyList(
    [env.NO_PROXY, env.no_proxy].filter(Boolean).join(','),
    KUAE_DIRECT_NO_PROXY_HOSTS,
  )
  return {
    ...env,
    NO_PROXY: merged,
    no_proxy: merged,
  }
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
      ...applyKuaeNoProxyBypass(withNodeInPath(process.env, nodePath)),
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
  private consecutiveHealthCheckFailures = 0
  private recentRestarts: number[] = []
  private lifecycleChain: Promise<GatewayStatus>
  private readonly healthCheckIntervalMs: number
  private readonly healthCheckFailureThreshold: number
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
    this.healthCheckFailureThreshold = Math.max(1, options.healthCheckFailureThreshold ?? 1)
    this.maxAutoRestarts = options.maxAutoRestarts ?? 3
    this.restartWindowMs = options.restartWindowMs ?? 5 * 60_000
    this.lifecycleChain = Promise.resolve(this.getStatus())
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
    const childAlive = Boolean(this.child && this.child.exitCode === null && this.child.signalCode === null)
    const running = this.statusValue === 'running' || childAlive
    const uptime = running && this.startedAt > 0 ? Date.now() - this.startedAt : 0

    return {
      running,
      port: this.currentPort,
      pid: this.child?.pid ?? null,
      uptime,
      status: this.statusValue,
    }
  }

  private enqueueLifecycle(fn: () => Promise<GatewayStatus>): Promise<GatewayStatus> {
    const next = this.lifecycleChain.then(fn, fn)
    this.lifecycleChain = next.catch(() => this.getStatus())
    return next
  }

  async start(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    return this.enqueueLifecycle(() => this.startInternal(options))
  }

  async stop(timeoutMs = 5000): Promise<GatewayStatus> {
    return this.enqueueLifecycle(() => this.stopInternal(timeoutMs))
  }

  async restart(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    return this.enqueueLifecycle(() => this.restartInternal(options))
  }

  private async startInternal(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    // `child.killed` is not a reliable signal for liveness (see smoke tests). Treat the
    // child as alive based on real process state.
    const childAlive = Boolean(this.child && this.child.exitCode === null && this.child.signalCode === null)
    if (childAlive && !this.stopping && !this.restarting) {
      // Recover from stale states (stopped/error) when the process is still alive.
      if (this.statusValue === 'stopped' || this.statusValue === 'error') {
        this.startedAt = this.startedAt > 0 ? this.startedAt : Date.now()
        this.statusValue = 'running'
        this.consecutiveHealthCheckFailures = 0
        this.startHealthCheckLoop()
        this.notifyStatusChange()
      }
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
      this.consecutiveHealthCheckFailures = 0
      this.startHealthCheckLoop()
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

  private async stopInternal(timeoutMs = 5000): Promise<GatewayStatus> {
    this.waitForReadyAbort?.abort()
    this.waitForReadyAbort = null
    this.stopHealthCheckLoop()
    this.healthCheckInFlight = false
    this.consecutiveHealthCheckFailures = 0
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

    // If the child is still alive after timeout, mark as error and clear `stopping`.
    // This matches smoke tests and prevents UI from being stuck in `stopped` state.
    const stillAlive = Boolean(this.child && this.child.exitCode === null && this.child.signalCode === null)
    this.stopping = false
    if (stillAlive) {
      this.statusValue = 'error'
      this.notifyStatusChange()
    }

    return this.getStatus()
  }

  private async restartInternal(options: GatewayLaunchOptions = {}): Promise<GatewayStatus> {
    await this.stopInternal()
    return this.startInternal(options)
  }

  /**
   * Wait until GET /health returns 200 before marking running — matches upstream: ready only when reachable.
   */
  private async waitForGatewayReady(): Promise<void> {
    this.waitForReadyAbort?.abort()
    this.waitForReadyAbort = new AbortController()
    const signal = this.waitForReadyAbort.signal
    const pollIntervalMs = 600
    const readyTimeoutMs = 300_000
    const deadline = Date.now() + readyTimeoutMs
    // Note: `child.killed` is not always reliable (see smoke tests). We use it only
    // to stop health polling elsewhere; here we keep waiting based on actual health.
    while (!signal.aborted && this.child && this.statusValue === 'starting') {
      const result = await this.checkGatewayHealth(this.currentPort)
      if (result.ok) {
        this.consecutiveHealthCheckFailures = 0
        this.statusValue = 'running'
        this.notifyStatusChange()
        return
      }
      if (Date.now() >= deadline) {
        this.emitLog('stderr', `[gateway] wait for ready timed out after ${Math.round(readyTimeoutMs / 1000)}s`)
        if (this.statusValue === 'starting') {
          this.statusValue = 'error'
          this.notifyStatusChange()
        }
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
      if (result.ok) {
        this.consecutiveHealthCheckFailures = 0
        return
      }

      this.consecutiveHealthCheckFailures += 1
      const detail = result.details ?? 'unknown'
      this.emitLog(
        'stderr',
        `[gateway] health check failed (${detail}) [${this.consecutiveHealthCheckFailures}/${this.healthCheckFailureThreshold}]`,
      )

      if (this.consecutiveHealthCheckFailures >= this.healthCheckFailureThreshold) {
        this.consecutiveHealthCheckFailures = 0
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
