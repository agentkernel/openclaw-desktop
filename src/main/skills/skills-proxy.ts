/**
 * Skills 状态代理 — 通过 Gateway RPC skills.status 获取技能清单
 * 合并 RPC 结果与本地 bundled 扫描，生成完整 SkillRegistryItem 列表
 */

import type { SkillRegistryItem, SkillSource } from '../../shared/types.js'
import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'
import { GatewayRpcError } from '../gateway/rpc-client.js'
import { listSkills } from '../registry/index.js'
import type { RegistryServiceDeps } from '../registry/index.js'

// ─── RPC 响应类型（与 OpenClaw skills.status 对齐）────────────────────────────

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

// ─── 映射 RPC 结果到 SkillRegistryItem ───────────────────────────────────────

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

// ─── 合并策略：RPC 为主，本地补充 ─────────────────────────────────────────────

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

// ─── 公开 API ────────────────────────────────────────────────────────────────

export type SkillsProxyDeps = RegistryServiceDeps

/**
 * 获取技能列表：优先 RPC skills.status，降级到本地扫描
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
