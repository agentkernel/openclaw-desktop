/**
 * Wizard completeSetup orchestration: write openclaw.json → auth-profiles → start gateway.
 */

import { app } from 'electron'
import type {
  WizardState,
  OpenClawConfig,
  ShellConfig,
  ModelProviderConfig,
  ModelProvider,
  AgentListEntry,
} from '../../shared/types.js'
import type { GatewayProcessManager } from '../gateway/index.js'
import { writeAuthProfile, writeAuthProfileToken } from './auth-profile-writer.js'
import { runConfigValidate, readOpenClawConfig } from '../config/index.js'
import { getUserDataDir } from '../utils/paths.js'
import path from 'node:path'
import { addProfileToAuthOrder } from '../providers/provider-config.js'

export interface WizardCompleteResult {
  ok: boolean
  port?: number
  error?: string
  phase?: 'config' | 'auth' | 'gateway'
  /** Config validation after wizard (auto-run) */
  validationResult?: { valid: boolean; issues: Array<{ path: string; message: string; allowedValues?: string[] }> }
}

/** Trim pasted secrets / IDs so openclaw.json and auth-profiles match what the user intended. */
export function sanitizeWizardState(state: WizardState): WizardState {
  const mc = state.modelConfig
  const modelConfig: WizardState['modelConfig'] = {
    ...mc,
    apiKey: mc.apiKey.trim(),
    modelId: mc.modelId.trim(),
    ...(mc.customProviderId !== undefined ? { customProviderId: mc.customProviderId.trim() } : {}),
    ...(mc.customBaseUrl !== undefined ? { customBaseUrl: mc.customBaseUrl.trim() } : {}),
    ...(mc.cloudflareAccountId !== undefined ? { cloudflareAccountId: mc.cloudflareAccountId.trim() } : {}),
    ...(mc.cloudflareGatewayId !== undefined ? { cloudflareGatewayId: mc.cloudflareGatewayId.trim() } : {}),
  }
  const gw = state.gatewayConfig
  const gatewayConfig: WizardState['gatewayConfig'] = {
    ...gw,
    authToken: gw.authToken.trim(),
  }
  return { ...state, modelConfig, gatewayConfig }
}

interface SetupDeps {
  writeOpenClawConfig: (config: OpenClawConfig) => void
  readShellConfig: () => ShellConfig
  writeShellConfig: (config: ShellConfig) => void
  gatewayManager: GatewayProcessManager
}

const MOONSHOT_MODELS = [
  { id: 'kimi-k2.5', name: 'Kimi K2.5', reasoning: false },
  { id: 'kimi-k2-0905-preview', name: 'Kimi K2 0905 Preview', reasoning: false },
  { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo', reasoning: false },
  { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', reasoning: true },
  { id: 'kimi-k2-thinking-turbo', name: 'Kimi K2 Thinking Turbo', reasoning: true },
] as const
const OLLAMA_LOCAL_AUTH_MARKER = 'ollama-local'

type ProviderSeed = {
  providerId: string
  authProviderId?: string
  baseUrl: string
  /** OpenClaw `models.providers.*.api`; omit for plugin-native providers (e.g. Google Gemini). */
  api?: string
  /**
   * Some third-party Anthropic-compatible hosts need `authHeader: true` (Bearer). MiniMax uses
   * default Anthropic `x-api-key` — do not set here.
   */
  authHeader?: boolean
}

const PROVIDER_SEEDS: Partial<Record<ModelProvider, ProviderSeed>> = {
  /** First-party / common API-key providers (wizard must emit `models.providers` + model aliases). */
  anthropic: {
    providerId: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    api: 'anthropic-messages',
  },
  openai: {
    providerId: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-responses',
  },
  google: {
    providerId: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  groq: {
    providerId: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    api: 'openai-completions',
  },
  cerebras: {
    providerId: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    api: 'openai-completions',
  },
  opencode: {
    providerId: 'opencode',
    baseUrl: 'https://opencode.ai/zen/v1',
    api: 'anthropic-messages',
    authHeader: true,
  },
  'vercel-ai-gateway': {
    providerId: 'vercel-ai-gateway',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    api: 'openai-completions',
  },
  moonshot: {
    providerId: 'moonshot',
    baseUrl: 'https://api.moonshot.ai/v1',
    api: 'openai-completions',
  },
  'kimi-coding': {
    providerId: 'kimi-coding',
    baseUrl: 'https://api.kimi.com/coding/',
    api: 'anthropic-messages',
    authHeader: true,
  },
  minimax: {
    providerId: 'minimax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    api: 'anthropic-messages',
    /** Omit authHeader (default): MiniMax uses Anthropic-style `x-api-key`; Bearer breaks with 401 invalid api key. */
  },
  xai: {
    providerId: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    api: 'openai-completions',
  },
  mistral: {
    providerId: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    api: 'openai-completions',
  },
  openrouter: {
    providerId: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    api: 'openai-completions',
  },
  litellm: {
    providerId: 'litellm',
    baseUrl: 'http://localhost:4000',
    api: 'openai-completions',
  },
  synthetic: {
    providerId: 'synthetic',
    baseUrl: 'https://api.synthetic.new/anthropic',
    api: 'anthropic-messages',
    authHeader: true,
  },
  venice: {
    providerId: 'venice',
    baseUrl: 'https://api.venice.ai/api/v1',
    api: 'openai-completions',
  },
  together: {
    providerId: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    api: 'openai-completions',
  },
  huggingface: {
    providerId: 'huggingface',
    baseUrl: 'https://router.huggingface.co/v1',
    api: 'openai-completions',
  },
  zai: {
    providerId: 'zai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    api: 'openai-completions',
  },
  xiaomi: {
    providerId: 'xiaomi',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    api: 'openai-completions',
  },
  qianfan: {
    providerId: 'qianfan',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    api: 'openai-completions',
  },
  kilocode: {
    providerId: 'kilocode',
    baseUrl: 'https://api.kilo.ai/api/gateway/',
    api: 'openai-completions',
  },
  volcengine: {
    providerId: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    api: 'openai-completions',
  },
  'volcengine-plan': {
    providerId: 'volcengine-plan',
    authProviderId: 'volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    api: 'openai-completions',
  },
  byteplus: {
    providerId: 'byteplus',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    api: 'openai-completions',
  },
  'byteplus-plan': {
    providerId: 'byteplus-plan',
    authProviderId: 'byteplus',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/coding/v3',
    api: 'openai-completions',
  },
  nvidia: {
    providerId: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    api: 'openai-completions',
  },
  chutes: {
    providerId: 'chutes',
    baseUrl: 'https://api.chutes.ai/v1',
    api: 'openai-completions',
  },
  'copilot-proxy': {
    providerId: 'copilot-proxy',
    baseUrl: 'http://localhost:3000/v1',
    api: 'openai-completions',
  },
  vllm: {
    providerId: 'vllm',
    baseUrl: 'http://127.0.0.1:8000/v1',
    api: 'openai-completions',
  },
  kuae: {
    providerId: 'kuae',
    authProviderId: 'openai-compatible',
    baseUrl: 'https://coding-plan-endpoint.kuaecloud.net/v1',
    api: 'openai-completions',
  },
  lmstudio: {
    providerId: 'lmstudio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    api: 'openai-responses',
  },
  ollama: {
    providerId: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    api: 'ollama',
  },
}

/** Providers that use API key auth profiles in wizard / model settings (exported for IPC). */
export const API_KEY_PROVIDER_SET = new Set<ModelProvider>([
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'opencode',
  'mistral',
  'minimax',
  'moonshot',
  'zai',
  'venice',
  'groq',
  'xai',
  'cerebras',
  'huggingface',
  'kilocode',
  'volcengine',
  'volcengine-plan',
  'byteplus',
  'byteplus-plan',
  'qianfan',
  'cloudflare-ai-gateway',
  'litellm',
  'together',
  'nvidia',
  'vllm',
  'vercel-ai-gateway',
  'synthetic',
  'xiaomi',
  'kimi-coding',
  'kuae',
])

function buildDefaultProviderModel(modelId: string): Record<string, unknown> & { id: string; name: string } {
  return {
    id: modelId,
    name: modelId,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  }
}

function buildMoonshotProvider(baseUrl: string): ModelProviderConfig {
  return {
    baseUrl,
    api: 'openai-completions',
    models: MOONSHOT_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 256000,
      maxTokens: 8192,
    })),
  }
}

export function resolveAuthProviderId(provider: ModelProvider): string {
  if (provider === 'moonshot-cn') return 'moonshot'
  return PROVIDER_SEEDS[provider]?.authProviderId ?? provider
}

function ensureProviderSeedConfig(config: OpenClawConfig, state: WizardState): void {
  const rawProvider = state.modelConfig.provider
  const provider = rawProvider === 'moonshot-cn' ? 'moonshot' : rawProvider
  if (provider === 'cloudflare-ai-gateway') {
    const accountId = state.modelConfig.cloudflareAccountId?.trim()
    const gatewayId = state.modelConfig.cloudflareGatewayId?.trim()
    const modelId = state.modelConfig.modelId.trim()
    if (!accountId || !gatewayId || !modelId) return
    const modelRef = `cloudflare-ai-gateway/${modelId}`
    config.agents = config.agents ?? {}
    config.agents.defaults = config.agents.defaults ?? {}
    config.agents.defaults.models = {
      ...(config.agents.defaults.models ?? {}),
      [modelRef]: {
        alias: modelId,
      },
    }
    config.models = config.models ?? {}
    config.models.mode = config.models.mode ?? 'merge'
    config.models.providers = config.models.providers ?? {}
    config.models.providers['cloudflare-ai-gateway'] = {
      ...(config.models.providers['cloudflare-ai-gateway'] ?? {}),
      baseUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic`,
      api: 'anthropic-messages',
      authHeader: true,
      models: [buildDefaultProviderModel(modelId)],
    }
    return
  }
  const seed = PROVIDER_SEEDS[provider]
  if (!seed) return

  const modelId = state.modelConfig.modelId.trim()
  if (!modelId) return

  const modelRef = `${seed.providerId}/${modelId}`
  config.agents = config.agents ?? {}
  config.agents.defaults = config.agents.defaults ?? {}
  config.agents.defaults.models = {
    ...(config.agents.defaults.models ?? {}),
    [modelRef]: {
      alias: modelId,
    },
  }

  config.models = config.models ?? {}
  config.models.mode = config.models.mode ?? 'merge'
  config.models.providers = config.models.providers ?? {}
  const moonshotBaseUrl =
    state.modelConfig.moonshotRegion === 'cn' || rawProvider === 'moonshot-cn'
      ? 'https://api.moonshot.cn/v1'
      : 'https://api.moonshot.ai/v1'
  if (provider === 'moonshot') {
    config.models.providers[seed.providerId] = {
      ...buildMoonshotProvider(moonshotBaseUrl),
    }
    return
  }
  if (provider === 'copilot-proxy') {
    const copilotModels = [
      'gpt-5.4',
      'gpt-5.4-pro',
      'gpt-5.2',
      'gpt-5.2-codex',
      'gpt-5.1',
      'gpt-5.1-codex',
      'gpt-5.1-codex-max',
      'gpt-5-mini',
      'claude-opus-4.6',
      'claude-opus-4.5',
      'claude-sonnet-4.6',
      'claude-sonnet-4.5',
      'claude-haiku-4.5',
      'gemini-3-pro',
      'gemini-3-flash',
      'grok-code-fast-1',
    ]
    config.models.providers[seed.providerId] = {
      baseUrl: seed.baseUrl,
      api: seed.api,
      apiKey: 'n/a',
      authHeader: false,
      models: copilotModels.map((id) => ({
        id,
        name: id,
        reasoning: false,
        input: ['text', 'image'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      })),
    }
    return
  }
  if (provider === 'ollama') {
    config.models.providers[seed.providerId] = {
      ...(config.models.providers[seed.providerId] ?? {}),
      baseUrl: seed.baseUrl,
      api: seed.api,
      apiKey: OLLAMA_LOCAL_AUTH_MARKER,
      models: [buildDefaultProviderModel(modelId)],
    }
    return
  }
  config.models.providers[seed.providerId] = {
    ...(config.models.providers[seed.providerId] ?? {}),
    baseUrl: seed.baseUrl,
    ...(seed.api ? { api: seed.api } : {}),
    ...(seed.authHeader !== undefined ? { authHeader: seed.authHeader } : {}),
    models: [buildDefaultProviderModel(modelId)],
  }
  // Match working openclaw.json: keep apiKey in models.providers.minimax alongside auth-profiles.
  if (provider === 'minimax' && state.modelConfig.apiKey.trim()) {
    config.models.providers[seed.providerId] = {
      ...(config.models.providers[seed.providerId] ?? {}),
      apiKey: state.modelConfig.apiKey.trim(),
    }
  }
}

function buildOpenClawConfig(state: WizardState): OpenClawConfig {
  const rawProvider = state.modelConfig.provider
  const modelId = state.modelConfig.modelId.trim()
  const providerId =
    rawProvider === 'custom'
      ? (state.modelConfig.customProviderId || 'custom')
      : rawProvider === 'moonshot-cn'
        ? 'moonshot'
        : rawProvider
  const modelRef = `${providerId}/${modelId}`
  /** MiniMax onboard-style configs use bare model id (matches working openclaw.json); other providers use provider/model. */
  const primaryModelRef = providerId === 'minimax' ? modelId : modelRef
  const config: OpenClawConfig = {
    gateway: {
      mode: 'local',
      port: state.gatewayConfig.port,
      bind: state.gatewayConfig.bind,
      auth: {
        mode: 'token',
        token: state.gatewayConfig.authToken,
      },
      // Upstream 2026.3+: Control UI webchat needs device identity when crypto.subtle exists.
      // Electron iframe may lack a full secure context — allow token-only on loopback for embedded UI.
      controlUi: {
        allowInsecureAuth: true,
      },
    },
    agents: {
      defaults: {
        model: {
          primary: primaryModelRef,
        },
        workspace: path.join(getUserDataDir(), 'workspace'),
      },
    },
  }

  if (!state.channelConfig.skipChannels) {
    config.channels = config.channels ?? {}
    const ch = state.channelConfig
    if (ch.feishu && (ch.feishu.appId || ch.feishu.appSecret)) {
      const f = ch.feishu
      config.channels.feishu = {
        ...(f.appId ? { appId: f.appId } : {}),
        ...(f.appSecret ? { appSecret: f.appSecret } : {}),
        ...(f.verificationToken ? { verificationToken: f.verificationToken } : {}),
        ...(f.encryptKey ? { encryptKey: f.encryptKey } : {}),
        dmPolicy: 'pairing',
      }
    }
    if (ch.telegram?.botToken?.trim()) {
      config.channels.telegram = { botToken: ch.telegram.botToken.trim() }
    }
    if (ch.discord?.token?.trim()) {
      config.channels.discord = { token: ch.discord.token.trim() }
    }
    const slackToken = ch.slack?.botToken?.trim()
    if (slackToken) {
      const s = ch.slack!
      config.channels.slack = {
        mode: s.mode ?? 'socket',
        botToken: slackToken,
        ...(s.signingSecret?.trim() ? { signingSecret: s.signingSecret.trim() } : {}),
        ...(s.appToken?.trim() ? { appToken: s.appToken.trim() } : {}),
      }
    }
    if (ch.selectedChannel === 'whatsapp') {
      config.channels.whatsapp = { enabled: true }
    }
  }

  if (state.modelConfig.provider === 'custom') {
    const baseUrl = state.modelConfig.customBaseUrl?.trim()
    const compatibility = state.modelConfig.customCompatibility ?? 'openai'
    const api = compatibility === 'anthropic' ? 'anthropic-messages' : 'openai-completions'
    if (baseUrl) {
      const thirdPartyAnthropic =
        compatibility === 'anthropic' && !baseUrl.includes('api.anthropic.com')
      const customModelRef = `${providerId}/${modelId}`
      config.agents = config.agents ?? {}
      config.agents.defaults = config.agents.defaults ?? {}
      config.agents.defaults.models = {
        ...(config.agents.defaults.models ?? {}),
        [customModelRef]: {
          alias: modelId,
        },
      }
      config.models = {
        mode: 'merge',
        providers: {
          [providerId]: {
            baseUrl,
            api,
            apiKey: state.modelConfig.apiKey.trim(),
            ...(thirdPartyAnthropic ? { authHeader: true } : {}),
            models: [buildDefaultProviderModel(modelId || 'default')],
          },
        },
      }
    }
  }

  if (state.modelConfig.provider !== 'custom') {
    ensureProviderSeedConfig(config, state)
  }

  const authProviderId = resolveAuthProviderId(state.modelConfig.provider)
  const providerForAuth = state.modelConfig.provider
  if (
    state.modelConfig.provider !== 'custom' &&
    (API_KEY_PROVIDER_SET.has(providerForAuth) || providerForAuth === 'moonshot-cn') &&
    state.modelConfig.apiKey.trim()
  ) {
    const profileName = providerForAuth === 'minimax' ? 'global' : 'default'
    const profileId = `${authProviderId}:${profileName}`
    /** MiniMax: auth.order uses shorthand `["global"]` (onboard / working configs); others use full profile ids. */
    const orderEntries =
      providerForAuth === 'minimax' ? [profileName] : [profileId]
    config.auth = {
      ...(config.auth ?? {}),
      profiles: {
        ...(config.auth?.profiles ?? {}),
        [profileId]: {
          provider: authProviderId,
          mode: 'api_key',
        },
      },
      order: {
        ...(config.auth?.order ?? {}),
        [authProviderId]: orderEntries,
      },
    }
  }
  if (providerForAuth === 'copilot-proxy') {
    config.auth = {
      ...(config.auth ?? {}),
      profiles: {
        ...(config.auth?.profiles ?? {}),
        'copilot-proxy:local': {
          provider: 'copilot-proxy',
          mode: 'token',
        },
      },
      order: {
        ...(config.auth?.order ?? {}),
        'copilot-proxy': ['local'],
      },
    }
    config.plugins = {
      ...(config.plugins as Record<string, unknown> ?? {}),
      entries: {
        ...((config.plugins as Record<string, unknown>)?.entries as Record<string, unknown> ?? {}),
        'copilot-proxy': { enabled: true },
      },
    }
  }

  // Baseline sections expected by openclaw doctor: wizard / logging / update / skills
  config.wizard = {
    lastRunAt: new Date().toISOString(),
    lastRunVersion: app.getVersion(),
    lastRunMode: 'local',
  }
  config.logging = {
    level: 'info',
    redactSensitive: 'tools',
  }
  config.update = {
    channel: 'stable',
    checkOnStart: true,
  }
  config.skills = {
    allowBundled: [],
  }

  return config
}

/**
 * Persist API keys / tokens for a wizard model selection (auth-profiles store).
 * Call after `writeOpenClawConfig` when the user supplied a new key.
 */
export function writeAuthCredentialsForModelState(sanitized: WizardState): {
  ok: true
} | {
  ok: false
  error: string
} {
  if (
    sanitized.modelConfig.provider !== 'custom' &&
    (API_KEY_PROVIDER_SET.has(sanitized.modelConfig.provider) ||
      sanitized.modelConfig.provider === 'moonshot-cn') &&
    sanitized.modelConfig.apiKey.trim()
  ) {
    try {
      const provider = resolveAuthProviderId(sanitized.modelConfig.provider)
      const profileName = sanitized.modelConfig.provider === 'minimax' ? 'global' : 'default'
      const metadata =
        sanitized.modelConfig.provider === 'cloudflare-ai-gateway' &&
        sanitized.modelConfig.cloudflareAccountId?.trim() &&
        sanitized.modelConfig.cloudflareGatewayId?.trim()
          ? {
              accountId: sanitized.modelConfig.cloudflareAccountId.trim(),
              gatewayId: sanitized.modelConfig.cloudflareGatewayId.trim(),
            }
          : undefined
      writeAuthProfile(provider, sanitized.modelConfig.apiKey, { profileName, metadata })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Credentials write failed: ${message}` }
    }
  }
  if (sanitized.modelConfig.provider === 'copilot-proxy') {
    try {
      writeAuthProfileToken('copilot-proxy:local', 'copilot-proxy', 'n/a')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Credentials write failed: ${message}` }
    }
  }
  return { ok: true }
}

/** Merge wizard-style model selection into existing `openclaw.json` (settings editor; preserves gateway/channels/etc.). */
export type ModelSettingsTarget =
  | { kind: 'defaults' }
  | { kind: 'agent'; agentId: string }

export function mergeModelIntoOpenClawConfig(
  base: OpenClawConfig,
  state: WizardState,
  target: ModelSettingsTarget,
): OpenClawConfig {
  const sanitized = sanitizeWizardState(state)
  const modelId = sanitized.modelConfig.modelId.trim()
  if (!modelId) {
    throw new Error('Model ID is required')
  }

  const rawProvider = sanitized.modelConfig.provider
  const providerId =
    rawProvider === 'custom'
      ? (sanitized.modelConfig.customProviderId || 'custom').trim() || 'custom'
      : rawProvider === 'moonshot-cn'
        ? 'moonshot'
        : rawProvider

  const modelRef = `${providerId}/${modelId}`
  const primaryModelRef = providerId === 'minimax' ? modelId : modelRef

  let config = JSON.parse(JSON.stringify(base)) as OpenClawConfig

  if (sanitized.modelConfig.provider === 'custom') {
    const baseUrl = sanitized.modelConfig.customBaseUrl?.trim()
    const compatibility = sanitized.modelConfig.customCompatibility ?? 'openai'
    const api = compatibility === 'anthropic' ? 'anthropic-messages' : 'openai-completions'
    if (baseUrl) {
      const thirdPartyAnthropic =
        compatibility === 'anthropic' && !baseUrl.includes('api.anthropic.com')
      const customModelRef = `${providerId}/${modelId}`
      config.agents = config.agents ?? {}
      config.agents.defaults = config.agents.defaults ?? {}
      config.agents.defaults.models = {
        ...(config.agents.defaults.models ?? {}),
        [customModelRef]: {
          alias: modelId,
        },
      }
      config.models = config.models ?? {}
      config.models.mode = config.models.mode ?? 'merge'
      config.models.providers = config.models.providers ?? {}
      const existingCustom = (config.models.providers[providerId] ?? {}) as ModelProviderConfig
      const apiKeyTrim = sanitized.modelConfig.apiKey.trim()
      config.models.providers[providerId] = {
        ...existingCustom,
        baseUrl,
        api,
        ...(apiKeyTrim ? { apiKey: apiKeyTrim } : {}),
        ...(thirdPartyAnthropic ? { authHeader: true } : {}),
        models: [buildDefaultProviderModel(modelId || 'default')],
      }
    }
  } else {
    ensureProviderSeedConfig(config, sanitized)
  }

  if (target.kind === 'defaults') {
    config.agents = config.agents ?? {}
    config.agents.defaults = config.agents.defaults ?? {}
    const existingModel = config.agents.defaults.model
    const fallbacks =
      typeof existingModel === 'object' &&
      existingModel &&
      !Array.isArray(existingModel) &&
      Array.isArray((existingModel as { fallbacks?: string[] }).fallbacks)
        ? (existingModel as { fallbacks: string[] }).fallbacks
        : undefined
    config.agents.defaults.model = {
      primary: primaryModelRef,
      ...(Array.isArray(fallbacks) && fallbacks.length ? { fallbacks } : {}),
    }
  } else {
    const agents = config.agents ?? {}
    const list = Array.isArray((agents as { list?: unknown[] }).list)
      ? [...((agents as { list: unknown[] }).list)]
      : []
    const idx = list.findIndex((a) => {
      const o = a as Record<string, unknown>
      return String(o.id ?? '') === target.agentId
    })
    if (idx < 0) {
      throw new Error(`Agent not found: ${target.agentId}`)
    }
    const prev = list[idx] as Record<string, unknown>
    list[idx] = { ...prev, model: primaryModelRef }
    config.agents = { ...agents, list: list as AgentListEntry[] }
  }

  const providerForAuth = sanitized.modelConfig.provider
  if (
    sanitized.modelConfig.provider !== 'custom' &&
    (API_KEY_PROVIDER_SET.has(providerForAuth) || providerForAuth === 'moonshot-cn') &&
    sanitized.modelConfig.apiKey.trim()
  ) {
    const authProviderId = resolveAuthProviderId(sanitized.modelConfig.provider)
    const profileName = providerForAuth === 'minimax' ? 'global' : 'default'
    const profileId = `${authProviderId}:${profileName}`
    config.auth = {
      ...(config.auth ?? {}),
      profiles: {
        ...(config.auth?.profiles ?? {}),
        [profileId]: {
          provider: authProviderId,
          mode: 'api_key',
        },
      },
      order: { ...(config.auth?.order ?? {}) },
    }
    config = addProfileToAuthOrder(config, authProviderId, profileId)
  }
  if (providerForAuth === 'copilot-proxy') {
    config.auth = {
      ...(config.auth ?? {}),
      profiles: {
        ...(config.auth?.profiles ?? {}),
        'copilot-proxy:local': {
          provider: 'copilot-proxy',
          mode: 'token',
        },
      },
      order: {
        ...(config.auth?.order ?? {}),
        'copilot-proxy': ['local'],
      },
    }
    config.plugins = {
      ...((config.plugins as Record<string, unknown>) ?? {}),
      entries: {
        ...((config.plugins as Record<string, unknown>)?.entries as Record<string, unknown> ?? {}),
        'copilot-proxy': { enabled: true },
      },
    }
  }

  return config
}

export async function handleWizardCompleteSetup(
  state: WizardState,
  deps: SetupDeps,
): Promise<WizardCompleteResult> {
  const sanitized = sanitizeWizardState(state)
  // 1. Write openclaw.json
  try {
    const config = buildOpenClawConfig(sanitized)
    deps.writeOpenClawConfig(config)
    readOpenClawConfig()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wizard] Config write failed:', message)
    return { ok: false, error: `Configuration write failed: ${message}`, phase: 'config' }
  }

  // 2. Write auth-profiles.json (skip for custom provider; stored in openclaw.json)
  const credResult = writeAuthCredentialsForModelState(sanitized)
  if (!credResult.ok) {
    console.error('[wizard] Auth profile write failed:', credResult.error)
    return {
      ok: false,
      error: credResult.error,
      phase: 'auth',
    }
  }

  // 3. Sync shellConfig.lastGatewayPort so WindowManager uses the correct port
  try {
    const shellConfig = deps.readShellConfig()
    if (shellConfig.lastGatewayPort !== sanitized.gatewayConfig.port) {
      deps.writeShellConfig({ ...shellConfig, lastGatewayPort: sanitized.gatewayConfig.port })
    }
  } catch (err) {
    console.warn('[wizard] shellConfig sync warning (non-fatal):', err instanceof Error ? err.message : String(err))
  }

  // 4. Validate config after wizard
  const validationResult = await runConfigValidate()
  const isEnvLimit = validationResult.issues.some(
    (i) => i.path.startsWith('__') && (i.path.includes('bundle') || i.path.includes('spawn') || i.path.includes('timeout')),
  )
  if (!validationResult.valid && !isEnvLimit) {
    const issuesSummary = validationResult.issues
      .map((i) => `${i.path}: ${i.message}`)
      .join('; ')
    console.warn('[wizard] Config validate failed after setup:', issuesSummary)
    return {
      ok: false,
      error: `Configuration validation failed: ${issuesSummary}`,
      phase: 'config',
      validationResult: {
        valid: false,
        issues: validationResult.issues,
      },
    }
  }
  if (!validationResult.valid && isEnvLimit) {
    console.warn('[wizard] Config validate skipped (bundle unavailable), proceeding with Gateway start')
  }

  // 5. Start Gateway with the wizard-configured port, bind, and token (--token / --auth token)
  try {
    const token = sanitized.gatewayConfig.authToken?.trim()
    await deps.gatewayManager.start({
      port: sanitized.gatewayConfig.port,
      bind: sanitized.gatewayConfig.bind,
      token: token || undefined,
      force: false, // First wizard completion: do not force port takeover
    })
    const status = deps.gatewayManager.getStatus()
    return { ok: true, port: status.port }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wizard] Gateway start failed:', message)
    return { ok: false, error: `Gateway start failed: ${message}`, phase: 'gateway' }
  }
}
