/**
 * logs.tail RPC 代理 — 通过 Gateway RPC 获取 Gateway 日志流
 */

import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'

export interface LogsTailPayload {
  file?: string
  cursor?: number
  size?: number
  lines?: string[]
  truncated?: boolean
  reset?: boolean
}

export interface LogsTailParams {
  cursor?: number
  limit?: number
  maxBytes?: number
}

/**
 * 通过 Gateway RPC logs.tail 获取日志切片
 * Gateway 未运行时抛出错误
 */
export async function tailLogsWithGateway(params: LogsTailParams = {}): Promise<LogsTailPayload> {
  const client = await createGatewayRpcClientFromConfig()
  try {
    const payload = await client.request<LogsTailPayload>('logs.tail', {
      cursor: params.cursor,
      limit: params.limit ?? 500,
      maxBytes: params.maxBytes ?? 250_000,
    })
    client.close()
    if (!payload || typeof payload !== 'object') {
      return { lines: [], truncated: false, reset: false }
    }
    return payload as LogsTailPayload
  } catch (err) {
    client.close()
    throw err
  }
}
