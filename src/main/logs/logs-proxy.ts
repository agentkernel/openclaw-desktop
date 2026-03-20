/** Gateway RPC proxy for `logs.tail` */

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
 * Fetch a slice via RPC; throws if gateway is down
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
