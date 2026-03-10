/**
 * Gateway RPC 客户端 — 通过 WebSocket 调用 Gateway RPC 方法
 * 与 OpenClaw Gateway 协议兼容（WebSocket，非 HTTP）
 */

import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { DEFAULT_GATEWAY_PORT } from '../../shared/constants.js'

const PROTOCOL_VERSION = 3
const CLIENT_ID = 'openclaw-desktop'
const CLIENT_VERSION = '0.1.2'

// ─── 错误类型 ─────────────────────────────────────────────────────────────

export class GatewayRpcError extends Error {
  constructor(
    message: string,
    public readonly code: GatewayRpcErrorCode,
    public readonly retryable = false,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'GatewayRpcError'
  }
}

export type GatewayRpcErrorCode =
  | 'GATEWAY_UNREACHABLE'
  | 'GATEWAY_TIMEOUT'
  | 'GATEWAY_AUTH_FAILED'
  | 'GATEWAY_RPC_ERROR'
  | 'GATEWAY_NOT_CONNECTED'

// ─── 选项与配置 ───────────────────────────────────────────────────────────

export interface GatewayRpcClientOptions {
  port: number
  token?: string
  timeoutMs?: number
  maxRetries?: number
}

// ─── 内部协议类型（与 OpenClaw Gateway 协议对齐）────────────────────────────

interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code?: string; message?: string; retryable?: boolean }
}

interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame

function isEventFrame(f: GatewayFrame): f is EventFrame {
  return (f as EventFrame).type === 'event'
}

function isResponseFrame(f: GatewayFrame): f is ResponseFrame {
  return (f as ResponseFrame).type === 'res'
}

// ─── GatewayRpcClient ───────────────────────────────────────────────────────

export class GatewayRpcClient {
  private ws: WebSocket | null = null
  private readonly port: number
  private readonly token?: string
  private readonly defaultTimeoutMs: number
  private readonly maxRetries: number
  private connectPromise: Promise<void> | null = null
  private readonly pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private connectNonce: string | null = null;
  private closed = false

  constructor(options: GatewayRpcClientOptions) {
    this.port = options.port
    this.token = options.token?.trim() || undefined
    this.defaultTimeoutMs = options.timeoutMs ?? 15_000
    this.maxRetries = Math.max(0, options.maxRetries ?? 3)
  }

  /**
   * 建立 WebSocket 连接并完成 connect 握手
   */
  async connect(): Promise<void> {
    if (this.closed) {
      throw new GatewayRpcError('client closed', 'GATEWAY_NOT_CONNECTED')
    }
    if (this.connectPromise) {
      return this.connectPromise
    }

    const url = `ws://127.0.0.1:${this.port}`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.connectPromise = this.doConnect(url)
        await this.connectPromise
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isRetryable =
          lastError instanceof GatewayRpcError && lastError.retryable
        if (!isRetryable || attempt >= this.maxRetries) {
          this.connectPromise = null
          throw lastError
        }
        const delayMs = Math.min(1000 * 2 ** attempt, 8000)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }

    this.connectPromise = null
    throw lastError ?? new GatewayRpcError('connection failed', 'GATEWAY_UNREACHABLE', true)
  }

  private doConnect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let connectResolved = false
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        if (!connectResolved) {
          connectResolved = true
          controller.abort()
          ws.close()
          reject(new GatewayRpcError(`connect timeout after ${this.defaultTimeoutMs}ms`, 'GATEWAY_TIMEOUT', true))
        }
      }, this.defaultTimeoutMs)

      const ws = new WebSocket(url, {
        handshakeTimeout: 10_000,
      })

      ws.on('error', (err: Error) => {
        if (!controller.signal.aborted && !connectResolved) {
          connectResolved = true
          clearTimeout(timeout)
          reject(new GatewayRpcError(String(err), 'GATEWAY_UNREACHABLE', true, err))
        }
      })

      ws.on('close', (code: number, reason: Buffer) => {
        if (!connectResolved) {
          connectResolved = true
          clearTimeout(timeout)
          reject(
            new GatewayRpcError(
              `connection closed: ${code} ${reason.toString()}`,
              'GATEWAY_UNREACHABLE',
              true
            )
          )
        }
      })

      ws.on('message', (data: WebSocket.RawData) => {
        if (connectResolved) {
          this.handleMessage(data)
          return
        }

        try {
          const parsed = JSON.parse(data.toString()) as GatewayFrame
          if (isEventFrame(parsed) && parsed.event === 'connect.challenge') {
            const payload = parsed.payload as { nonce?: string } | undefined
            const nonce = payload?.nonce?.trim()
            if (!nonce) {
              reject(new GatewayRpcError('connect.challenge missing nonce', 'GATEWAY_RPC_ERROR'))
              ws.close()
              return
            }
            this.connectNonce = nonce
            this.sendConnect(ws)
            return
          }
          if (isResponseFrame(parsed) && parsed.id === 'connect-req') {
            connectResolved = true
            clearTimeout(timeout)
            if (parsed.ok) {
              this.ws = ws
              resolve()
            } else {
              const msg = parsed.error?.message ?? 'connect failed'
              const code = parsed.error?.code === 'UNAUTHORIZED' ? 'GATEWAY_AUTH_FAILED' : 'GATEWAY_RPC_ERROR'
              reject(new GatewayRpcError(msg, code, false))
              ws.close()
            }
          }
        } catch (err) {
          if (!connectResolved) {
            connectResolved = true
            clearTimeout(timeout)
            reject(new GatewayRpcError(String(err), 'GATEWAY_RPC_ERROR', false, err))
            ws.close()
          }
        }
      })
    })
  }

  private sendConnect(ws: WebSocket): void {
    const auth = this.token ? { token: this.token } : undefined
    const connectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: process.platform,
        mode: 'backend',
      },
      auth,
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
    }
    const frame: RequestFrame = {
      type: 'req',
      id: 'connect-req',
      method: 'connect',
      params: connectParams,
    }
    ws.send(JSON.stringify(frame))
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const parsed = JSON.parse(data.toString()) as GatewayFrame
      if (isResponseFrame(parsed)) {
        const pending = this.pending.get(parsed.id)
        if (pending) {
          this.pending.delete(parsed.id)
          if (parsed.ok) {
            pending.resolve(parsed.payload)
          } else {
            const err = parsed.error
            const code = mapErrorCode(err?.code)
            const message = err?.message ?? 'RPC error'
            pending.reject(new GatewayRpcError(message, code, err?.retryable ?? false))
          }
        }
      }
    } catch {
      // ignore parse errors for unknown frames
    }
  }

  /**
   * 发送 RPC 请求，等待响应
   */
  async request<T = unknown>(
    method: string,
    params?: unknown,
    opts?: { timeoutMs?: number }
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect()
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new GatewayRpcError('not connected', 'GATEWAY_NOT_CONNECTED')
    }

    const id = randomUUID()
    const timeoutMs = opts?.timeoutMs ?? this.defaultTimeoutMs

    const frame: RequestFrame = { type: 'req', id, method, params }
    this.ws.send(JSON.stringify(frame))

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new GatewayRpcError(`timeout after ${timeoutMs}ms`, 'GATEWAY_TIMEOUT', true))
        }
      }, timeoutMs)

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
    })
  }

  /**
   * Streaming 模式占位：当前委托给 request，若有 onChunk 则回调 payload 一次
   */
  async stream(
    method: string,
    params?: unknown,
    onChunk?: (chunk: unknown) => void
  ): Promise<void> {
    const result = await this.request(method, params)
    if (onChunk && result !== undefined) {
      onChunk(result)
    }
  }

  close(): void {
    this.closed = true
    this.connectPromise = null
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    for (const [, { reject }] of this.pending) {
      reject(new GatewayRpcError('client closed', 'GATEWAY_NOT_CONNECTED'))
    }
    this.pending.clear()
  }
}

function mapErrorCode(code?: string): GatewayRpcErrorCode {
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return 'GATEWAY_AUTH_FAILED'
  if (code === 'TIMEOUT') return 'GATEWAY_TIMEOUT'
  if (code === 'UNAVAILABLE') return 'GATEWAY_UNREACHABLE'
  return 'GATEWAY_RPC_ERROR'
}

// ─── 工厂函数 ─────────────────────────────────────────────────────────────

/**
 * 从 ShellConfig + OpenClawConfig 创建 GatewayRpcClient
 * port: shellConfig.lastGatewayPort
 * token: openclawConfig.gateway?.auth?.token
 * 使用动态 import 避免在非 Electron 环境加载 config（依赖 electron.app）
 */
export async function createGatewayRpcClientFromConfig(
  overrides?: Partial<GatewayRpcClientOptions>
): Promise<GatewayRpcClient> {
  const { readShellConfig } = await import('../config/shell-config.js')
  const { readOpenClawConfig } = await import('../config/openclaw-config.js')
  const shellConfig = readShellConfig()
  const openclawConfig = readOpenClawConfig()
  const port = overrides?.port ?? shellConfig.lastGatewayPort ?? DEFAULT_GATEWAY_PORT
  const token = overrides?.token ?? (openclawConfig.gateway?.auth?.token?.trim() || undefined)
  return new GatewayRpcClient({
    port,
    token,
    timeoutMs: 15_000,
    maxRetries: 3,
    ...overrides,
  })
}
