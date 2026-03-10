/**
 * Provider 配置管理 — models.providers、agents.defaults、auth.order
 * 与 openclaw-config 协同，供 LLM API 管理 UI 使用
 */

import type {
  OpenClawConfig,
  ModelProviderConfig,
  AgentDefaultsConfig,
  AuthConfig,
} from '../../shared/types.js'

export interface ProviderSummary {
  providerId: string
  baseUrl?: string
  api?: string
  hasApiKey: boolean
  models?: Array<{ id: string; name?: string }>
}

export interface ModelDefaultsSummary {
  primary?: string
  fallbacks?: string[]
}

export interface ProvidersListResult {
  profiles: Array<{ profileId: string; provider: string; hasKey: boolean }>
  providers: ProviderSummary[]
  modelDefaults: ModelDefaultsSummary
  authOrder: Record<string, string[]>
}

function getProviderSummary(providerId: string, config: ModelProviderConfig): ProviderSummary {
  return {
    providerId,
    baseUrl: config.baseUrl,
    api: config.api,
    hasApiKey: Boolean(config.apiKey?.length),
    models: config.models,
  }
}

/**
 * 获取 Provider 与模型默认值摘要（用于 UI 展示，不含明文 key）
 */
export function getProvidersSummary(
  config: OpenClawConfig,
  profileItems: Array<{ profileId: string; provider: string; hasKey: boolean }>,
): ProvidersListResult {
  const providers: ProviderSummary[] = []
  const providersConfig = config?.models?.providers ?? {}
  for (const [id, p] of Object.entries(providersConfig)) {
    if (p && typeof p === 'object') {
      providers.push(getProviderSummary(id, p as ModelProviderConfig))
    }
  }

  let modelDefaults: ModelDefaultsSummary = {}
  const modelCfg = config?.agents?.defaults?.model
  if (typeof modelCfg === 'string') {
    modelDefaults = { primary: modelCfg }
  } else if (modelCfg && typeof modelCfg === 'object') {
    modelDefaults = {
      primary: modelCfg.primary,
      fallbacks: Array.isArray((modelCfg as { fallbacks?: string[] }).fallbacks)
        ? (modelCfg as { fallbacks: string[] }).fallbacks
        : undefined,
    }
  }

  const authOrder = (config?.auth?.order ?? {}) as Record<string, string[]>

  return {
    profiles: profileItems,
    providers,
    modelDefaults,
    authOrder,
  }
}

/**
 * 保存单个 provider 配置到 models.providers
 */
export function saveProviderConfig(
  currentConfig: OpenClawConfig,
  providerId: string,
  config: Partial<ModelProviderConfig>,
): OpenClawConfig {
  const next = { ...currentConfig }
  next.models = next.models ?? { providers: {} }
  next.models.providers = next.models.providers ?? {}
  const existing = (next.models.providers[providerId] ?? {}) as ModelProviderConfig
  next.models.providers[providerId] = { ...existing, ...config } as ModelProviderConfig
  return next
}

/**
 * 设置模型默认值与 fallback 链
 */
export function setModelDefaults(
  currentConfig: OpenClawConfig,
  opts: { primary?: string; fallbacks?: string[] },
): OpenClawConfig {
  const next = { ...currentConfig }
  next.agents = next.agents ?? {}
  next.agents.defaults = next.agents.defaults ?? ({} as AgentDefaultsConfig)
  const modelCfg = next.agents.defaults.model
  if (typeof modelCfg === 'string') {
    next.agents.defaults.model = {
      primary: opts.primary ?? modelCfg,
      fallbacks: opts.fallbacks,
    } as AgentModelDefaultsExt
  } else {
    next.agents.defaults.model = {
      ...(typeof modelCfg === 'object' && modelCfg ? modelCfg : {}),
      ...(opts.primary !== undefined && { primary: opts.primary }),
      ...(opts.fallbacks !== undefined && { fallbacks: opts.fallbacks }),
    } as AgentModelDefaultsExt
  }
  return next
}

/** 扩展类型以支持 fallbacks */
interface AgentModelDefaultsExt {
  primary?: string
  fallbacks?: string[]
}

/**
 * 设置模型别名（agents.defaults.models）
 * 与 OpenClaw models aliases 对齐
 */
export function setModelAliases(
  currentConfig: OpenClawConfig,
  aliases: Record<string, { alias?: string }>,
): OpenClawConfig {
  const next = { ...currentConfig }
  next.agents = next.agents ?? {}
  next.agents.defaults = next.agents.defaults ?? ({} as AgentDefaultsConfig)
  next.agents.defaults.models = aliases
  return next
}

/**
 * 更新 auth.order 中某 provider 的 profile 顺序
 */
export function updateAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileIds: string[],
): OpenClawConfig {
  const next = { ...currentConfig }
  next.auth = next.auth ?? ({} as AuthConfig)
  next.auth.order = { ...(next.auth.order ?? {}) }
  next.auth.order[providerId] = profileIds
  return next
}

/**
 * 将 profileId 加入 auth.order[providerId]，若不存在则插入首位
 */
export function addProfileToAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileId: string,
): OpenClawConfig {
  const order = (currentConfig?.auth?.order ?? {}) as Record<string, string[]>
  const existing = order[providerId] ?? []
  if (existing.includes(profileId)) return currentConfig
  return updateAuthOrder(currentConfig, providerId, [profileId, ...existing])
}

/**
 * 从 auth.order[providerId] 移除 profileId
 */
export function removeProfileFromAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileId: string,
): OpenClawConfig {
  const order = (currentConfig?.auth?.order ?? {}) as Record<string, string[]>
  const existing = order[providerId] ?? []
  const filtered = existing.filter((id) => id !== profileId)
  if (filtered.length === existing.length) return currentConfig
  return updateAuthOrder(currentConfig, providerId, filtered)
}
