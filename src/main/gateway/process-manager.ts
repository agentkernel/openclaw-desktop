import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import type { GatewayStatus, GatewayStatusValue, OpenClawConfig } from '../../shared/types.js'
import { DEFAULT_GATEWAY_PORT } from '../../shared/constants.js'
import { getBundledNodePath, getBundledOpenClawDir, getBundledOpenClawPath, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import { logInfo, logWarn } from '../utils/logger.js'
import { readOpenClawConfig } from '../config/index.js'

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
  /** Interval for desktop-side gateway liveness probes (TCP + optional HTTP fallback). Never set to 0 to “skip”; use a large value only if you must slow probes. */
  healthCheckIntervalMs?: number
  /** Consecutive probe failures before SIGTERM + auto-restart. Default 3 avoids killing the gateway when its HTTP handler is briefly backlogged. */
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

/** Feishu / Lark API hosts — bypass broken HTTPS proxies where direct works */
const FEISHU_DIRECT_NO_PROXY_HOSTS = ['open.feishu.cn', '.feishu.cn', 'open.larksuite.com', '.larksuite.com'] as const
const MINIMAX_ENV_OVERRIDE_KEYS = ['MINIMAX_API_KEY', 'MINIMAX_CODE_PLAN_KEY'] as const

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

/**
 * Append direct-connection hosts to NO_PROXY / no_proxy (Node fetch/undici).
 * Set OPENCLAW_SKIP_KUAE_NO_PROXY / OPENCLAW_SKIP_FEISHU_NO_PROXY to disable subsets.
 */
function applyOpenClawNoProxyBypass(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  let merged = [env.NO_PROXY, env.no_proxy].filter(Boolean).join(',')
  if (env.OPENCLAW_SKIP_KUAE_NO_PROXY !== '1' && env.OPENCLAW_SKIP_KUAE_NO_PROXY !== 'true') {
    merged = mergeNoProxyList(merged, KUAE_DIRECT_NO_PROXY_HOSTS)
  }
  if (env.OPENCLAW_SKIP_FEISHU_NO_PROXY !== '1' && env.OPENCLAW_SKIP_FEISHU_NO_PROXY !== 'true') {
    merged = mergeNoProxyList(merged, FEISHU_DIRECT_NO_PROXY_HOSTS)
  }
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

function hasConfiguredMinimaxProfile(config?: OpenClawConfig): boolean {
  const profiles = config?.auth?.profiles
  if (!profiles || typeof profiles !== 'object') return false
  return Object.keys(profiles).some((id) => id.toLowerCase().startsWith('minimax:'))
}

function stripEnvKeysCaseInsensitive(env: NodeJS.ProcessEnv, keys: readonly string[]): NodeJS.ProcessEnv {
  const normalized = new Set(keys.map((k) => k.toLowerCase()))
  const next: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(env)) {
    if (normalized.has(k.toLowerCase())) continue
    next[k] = v
  }
  return next
}

function listPresentEnvKeysCaseInsensitive(env: NodeJS.ProcessEnv, keys: readonly string[]): string[] {
  const normalized = new Set(keys.map((k) => k.toLowerCase()))
  const present = new Set<string>()
  for (const k of Object.keys(env)) {
    if (normalized.has(k.toLowerCase())) present.add(k)
  }
  return [...present]
}

/** Loopback hosts for NO_PROXY so undici `fetch` in the main process never sends health checks via HTTP(S)_PROXY. */
const LOOPBACK_NO_PROXY_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1'] as const

/**
 * Merge loopback into NO_PROXY / no_proxy once (Electron main). Child gateway env is patched separately
 * via {@link applyOpenClawNoProxyBypass}; without this, `fetch('http://127.0.0.1:…')` can hang behind a proxy
 * until AbortSignal timeout → spurious gateway restarts.
 */
function ensureMainProcessLoopbackNoProxy(): void {
  for (const key of ['NO_PROXY', 'no_proxy'] as const) {
    const merged = mergeNoProxyList(process.env[key], LOOPBACK_NO_PROXY_HOSTS)
    process.env[key] = merged
  }
}

ensureMainProcessLoopbackNoProxy()

export function createGatewayLaunchSpec(options: GatewayLaunchOptions = {}, config?: OpenClawConfig): GatewayLaunchSpec {
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

  const envWithNode = withNodeInPath(process.env, nodePath)
  const envWithoutMinimaxOverride = hasConfiguredMinimaxProfile(config)
    ? stripEnvKeysCaseInsensitive(envWithNode, MINIMAX_ENV_OVERRIDE_KEYS)
    : envWithNode

  return {
    command: nodePath,
    args,
    // OpenClaw resolves Control UI via process.cwd() (see resolveControlUiRootSync: cwd/dist/control-ui).
    // Install dir (exe parent) is wrong here; a stray dist/control-ui/index.html without assets yields a black UI.
    cwd: getBundledOpenClawDir(),
    env: {
      ...applyOpenClawNoProxyBypass(envWithoutMinimaxOverride),
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
  private readonly dedupWindowMs = 6000
  private readonly dedupState = new Map<
    string,
    { lastSeen: number; suppressed: number; sample: string; stream: 'stdout' | 'stderr' }
  >()
  private waitForReadyAbort: AbortController | null = null

  constructor(options: GatewayProcessManagerOptions = {}) {
    this.onLog = options.onLog
    this.onStatusChange = options.onStatusChange
    // Slightly spaced checks; TCP probe below avoids HTTP backlog false positives under plugin load.
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 12_000
    this.healthCheckFailureThreshold = Math.max(1, options.healthCheckFailureThreshold ?? 3)
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

    // Migrate and persist openclaw.json before the child reads OPENCLAW_CONFIG_PATH (e.g. MiniMax `authHeader`).
    const runtimeConfig = readOpenClawConfig()
    const minimaxProfileConfigured = hasConfiguredMinimaxProfile(runtimeConfig)
    const minimaxEnvKeysPresent = listPresentEnvKeysCaseInsensitive(process.env, MINIMAX_ENV_OVERRIDE_KEYS)
    if (minimaxProfileConfigured) {
      if (minimaxEnvKeysPresent.length > 0) {
        logInfo(
          `[gateway] MiniMax env guard active; stripping inherited env keys: ${minimaxEnvKeysPresent.join(', ')}`,
        )
      } else {
        logInfo('[gateway] MiniMax env guard active; no inherited MiniMax env keys detected')
      }
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

    const launchSpec = createGatewayLaunchSpec(options, runtimeConfig)
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
    // TCP connect completes in the kernel — it does not wait for the gateway HTTP handler to run.
    // When the Node gateway is busy (long RPC / plugin init), queued GET /health can exceed timeouts
    // and falsely trigger SIGTERM restarts, which empties the embedded Control UI.
    const tcp = await this.checkGatewayTcpPortOpen(port)
    if (tcp.ok) {
      return tcp
    }
    const endpoints = ['/health', '/api/health', '/']
    let lastResult: GatewayHealthCheckResult = tcp
    for (const endpoint of endpoints) {
      const result = await this.checkGatewayHealthEndpoint(port, endpoint)
      if (result.ok) {
        return result
      }
      lastResult = result
    }
    return lastResult
  }

  /** Fast liveness: if something listens on the gateway port, the process is almost certainly up. */
  private checkGatewayTcpPortOpen(port: number): Promise<GatewayHealthCheckResult> {
    const timeoutMs = 8000
    return new Promise((resolve) => {
      let settled = false
      const finish = (result: GatewayHealthCheckResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      const socket = net.connect({ port, host: '127.0.0.1', family: 4 })
      const timer = setTimeout(() => {
        socket.destroy()
        finish({ ok: false, details: 'This operation was aborted' })
      }, timeoutMs)

      socket.once('connect', () => {
        clearTimeout(timer)
        socket.end()
        finish({ ok: true })
      })
      socket.once('error', (err) => {
        clearTimeout(timer)
        finish({ ok: false, details: err.message })
      })
    })
  }

  private async checkGatewayHealthEndpoint(port: number, endpoint: string): Promise<GatewayHealthCheckResult> {
    const timeoutMs = 12_000
    // Use node:http (not global fetch/undici): corporate HTTP_PROXY often omits loopback from NO_PROXY,
    // causing fetch to hang until abort — false "gateway down" and endless SIGTERM restarts.
    return new Promise((resolve) => {
      let settled = false
      const finish = (result: GatewayHealthCheckResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      let req: http.ClientRequest | null = null
      const timer = setTimeout(() => {
        req?.destroy()
        finish({ ok: false, details: 'This operation was aborted' })
      }, timeoutMs)

      req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: endpoint,
          method: 'GET',
          family: 4,
        },
        (res) => {
          res.resume()
          clearTimeout(timer)
          // Any HTTP response means the TCP port is open and the server is listening.
          // We do NOT require 2xx because:
          //  - /health and /api/health may return 404 (not implemented in all gateway versions)
          //  - / may return 403 when accessed without auth token
          finish({ ok: true, statusCode: res.statusCode })
        },
      )
      req.on('error', (err) => {
        clearTimeout(timer)
        finish({ ok: false, details: err.message })
      })
      req.end()
    })
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
    const now = Date.now()
    this.flushExpiredDedupSummaries(now)
    const feishuRegKey = this.getFeishuRegistrationDedupKey(message)
    if (feishuRegKey != null) {
      const normalized = this.normalizeLogForDedup(message)
      const key = `${stream}|${feishuRegKey}`
      const prev = this.dedupState.get(key)
      if (prev && now - prev.lastSeen <= this.dedupWindowMs) {
        prev.lastSeen = now
        prev.suppressed += 1
        this.dedupState.set(key, prev)
        return
      }
      if (prev && prev.suppressed > 0) {
        this.emitRawLog(stream, `[gateway] suppressed ${prev.suppressed} repeated log lines: ${prev.sample}`)
      }
      this.dedupState.set(key, { lastSeen: now, suppressed: 0, sample: normalized, stream })
    }
    this.emitRawLog(stream, message)
  }

  private emitRawLog(stream: 'stdout' | 'stderr', message: string): void {
    const line = `[gateway:${stream}] ${message}`
    try {
      if (stream === 'stderr') {
        logWarn(line)
      } else {
        logInfo(line)
      }
    } catch {
      // EPIPE / broken pipe; output pipe closed, safe to ignore
    }
    this.onLog?.({ stream, message })
    this.logListeners.forEach((listener) => listener({ stream, message }))
  }

  private normalizeLogForDedup(message: string): string {
    return message
      .replace(/^\d{4}-\d{2}-\d{2}T[^\s]+\s+/, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * OpenClaw may log Feishu/Lark tool/plugin registration on many inbound paths (e.g. each message dispatch).
   * Dedupe by a stable key so lines that differ only by ids/timestamps still collapse within {@link dedupWindowMs}.
   */
  private getFeishuRegistrationDedupKey(message: string): string | null {
    const normalized = this.normalizeLogForDedup(message)
    if (!/\b(feishu|lark)\b/i.test(normalized)) return null
    if (!/\b(registered|register|re-?registered|re-?register)\b/i.test(normalized)) return null
    // feishu_* / lark_* tool ids, or generic plugin/dispatch paths (upstream wording varies by version).
    if (
      /\bfeishu_[\w]+\b/i.test(normalized)
      || /\blark_[\w]+\b/i.test(normalized)
      || /\bplugin\b/i.test(normalized)
      || /\btool(s)?\b/i.test(normalized)
      || /\bextension\b/i.test(normalized)
      || /\bhandler\b/i.test(normalized)
      || /\badapter\b/i.test(normalized)
      || /\bdispatch(?:ed|ing)?\b/i.test(normalized)
    ) {
      return 'feishu-plugin-registration'
    }
    return null
  }

  private flushExpiredDedupSummaries(now: number): void {
    for (const [key, entry] of this.dedupState.entries()) {
      if (now - entry.lastSeen <= this.dedupWindowMs) continue
      if (entry.suppressed > 0) {
        this.emitRawLog(entry.stream, `[gateway] suppressed ${entry.suppressed} repeated log lines: ${entry.sample}`)
      }
      this.dedupState.delete(key)
    }
  }

  private notifyStatusChange(): void {
    const status = this.getStatus()
    this.onStatusChange?.(status)
    this.statusListeners.forEach((listener) => listener(status))
  }
}
