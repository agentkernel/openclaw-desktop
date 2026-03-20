/**
 * Models list via RPC `models.list`, falling back to config parsing when gateway is down.
 */

import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'
import { GatewayRpcError } from '../gateway/rpc-client.js'
import type { OpenClawConfig } from '../../shared/types.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ModelListItem {
  id: string
  name?: string
  provider?: string
}

export interface ModelsListResult {
  models: ModelListItem[]
}

// ─── RPC shape (models.list) ─────────────────────────────────────────────────

interface ModelsListRpcPayload {
  models?: Array<{ id?: string; name?: string; provider?: string; [key: string]: unknown }>
}

// ─── Extract from config ─────────────────────────────────────────────────────

function extractModelsFromConfig(config: OpenClawConfig): ModelListItem[] {
  const providers = config?.models?.providers ?? {}
  const items: ModelListItem[] = []
  const seen = new Set<string>()

  for (const [providerId, p] of Object.entries(providers)) {
    if (!p || typeof p !== 'object') continue
    const models = (p as { models?: Array<{ id: string; name?: string }> }).models ?? []
    for (const m of models) {
      const id = m.id ?? ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      items.push({
        id,
        name: m.name,
        provider: providerId,
      })
    }
  }

  return items.sort((a, b) => a.id.localeCompare(b.id))
}

// ─── Map RPC → UI rows ───────────────────────────────────────────────────────

function mapRpcModels(payload: ModelsListRpcPayload): ModelListItem[] {
  const raw = payload?.models ?? []
  return raw
    .map((m) => {
      const id = m.id ?? m.name ?? ''
      if (!id) return null
      return {
        id: String(id),
        name: typeof m.name === 'string' ? m.name : undefined,
        provider: typeof m.provider === 'string' ? m.provider : undefined,
      } as ModelListItem
    })
    .filter((x): x is ModelListItem => x !== null)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List models: RPC first, config fallback
 */
export async function listModelsWithProxy(
  readOpenClawConfig: () => OpenClawConfig
): Promise<ModelsListResult> {
  let client: Awaited<ReturnType<typeof createGatewayRpcClientFromConfig>> | null = null

  try {
    client = await createGatewayRpcClientFromConfig()
    const payload = await client.request<ModelsListRpcPayload>('models.list', {})
    client.close()
    client = null

    const models = mapRpcModels(payload ?? {})
    return { models }
  } catch (err) {
    if (client) {
      try {
        client.close()
      } catch {
        /* ignore */
      }
    }
    if (err instanceof GatewayRpcError) {
      if (
        err.code === 'GATEWAY_UNREACHABLE' ||
        err.code === 'GATEWAY_NOT_CONNECTED' ||
        err.code === 'GATEWAY_TIMEOUT'
      ) {
        const config = readOpenClawConfig()
        const models = extractModelsFromConfig(config)
        return { models }
      }
    }
    const config = readOpenClawConfig()
    const models = extractModelsFromConfig(config)
    return { models }
  }
}
