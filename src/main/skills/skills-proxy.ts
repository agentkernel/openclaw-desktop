/**
 * Skills via `skills.status` RPC merged with local bundled scan → SkillRegistryItem[].
 */

import type { SkillRegistryItem, SkillSource } from '../../shared/types.js'
import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'
import { GatewayRpcError } from '../gateway/rpc-client.js'
import { listSkills } from '../registry/index.js'
import type { RegistryServiceDeps } from '../registry/index.js'

// ─── RPC shape (skills.status) ───────────────────────────────────────────────

interface SkillStatusEntry {
  name?: string
  description?: string
  source?: string
  bundled?: boolean
  filePath?: string
  baseDir?: string
  skillKey?: string
  disabled?: boolean
  eligible?: boolean
  missing?: { bins?: string[]; env?: string[]; config?: string[]; os?: string[] }
}

interface SkillsStatusReport {
  workspaceDir?: string
  managedSkillsDir?: string
  skills?: SkillStatusEntry[]
}

// ─── Map RPC → SkillRegistryItem ─────────────────────────────────────────────

function mapRpcEntryToItem(entry: SkillStatusEntry): SkillRegistryItem {
  const skillKey = entry.skillKey ?? entry.name ?? 'unknown'
  const source = mapRpcSourceToSkillSource(entry.source, entry.bundled)
  const missing = entry.missing ?? {}
  return {
    id: skillKey,
    name: entry.name ?? skillKey,
    description: entry.description,
    source,
    enabled: !entry.disabled,
    path: entry.baseDir ?? entry.filePath ?? '',
    version: undefined,
    requires: {
      bins: missing.bins ?? [],
      env: missing.env ?? [],
      config: missing.config ?? [],
    },
  }
}

function mapRpcSourceToSkillSource(
  rpcSource?: string,
  bundled?: boolean
): SkillSource {
  if (bundled) return 'bundled'
  if (rpcSource === 'bundled') return 'bundled'
  if (rpcSource === 'workspace' || rpcSource === 'managed') return 'user-workspace'
  if (rpcSource === 'extra' || rpcSource === 'load-path') return 'load-path'
  return 'user-workspace'
}

// ─── Merge: RPC authoritative, local fills gaps ──────────────────────────────

function mergeSkills(
  rpcItems: SkillRegistryItem[],
  localItems: SkillRegistryItem[]
): SkillRegistryItem[] {
  const byId = new Map<string, SkillRegistryItem>()
  for (const item of rpcItems) {
    byId.set(item.id, item)
  }
  for (const item of localItems) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    } else {
      const existing = byId.get(item.id)!
      byId.set(item.id, { ...existing, enabled: item.enabled })
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SkillsProxyDeps = RegistryServiceDeps

/**
 * List skills: RPC first, local scan fallback
 */
export async function listSkillsWithProxy(
  deps: SkillsProxyDeps,
  source?: 'all' | 'bundled' | 'user'
): Promise<SkillRegistryItem[]> {
  const localItems = listSkills(deps, source)

  let client: Awaited<ReturnType<typeof createGatewayRpcClientFromConfig>> | null = null
  try {
    client = await createGatewayRpcClientFromConfig()
    const report = await client.request<SkillsStatusReport>('skills.status', {})
    client.close()
    client = null

    const rpcSkills = report?.skills ?? []
    const rpcItems = rpcSkills.map((e) => mapRpcEntryToItem(e))
    const merged = mergeSkills(rpcItems, localItems)

    if (source === 'bundled') return merged.filter((s) => s.source === 'bundled')
    if (source === 'user') return merged.filter((s) => s.source !== 'bundled')
    return merged
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
        return localItems
      }
    }
    return localItems
  }
}
