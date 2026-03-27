/**
 * Infer ModelConfig from existing openclaw.json for the settings model editor.
 */

import type { ModelConfig, ModelProvider, OpenClawConfig } from '../../shared/types.js'

const KNOWN_PROVIDERS = new Set<ModelProvider>([
  'anthropic',
  'openai',
  'openai-codex',
  'google',
  'openrouter',
  'opencode',
  'mistral',
  'minimax',
  'moonshot',
  'moonshot-cn',
  'zai',
  'venice',
  'groq',
  'xai',
  'cerebras',
  'huggingface',
  'github-copilot',
  'kilocode',
  'volcengine',
  'volcengine-plan',
  'byteplus',
  'byteplus-plan',
  'qianfan',
  'bedrock',
  'cloudflare-ai-gateway',
  'litellm',
  'together',
  'nvidia',
  'qwen-portal',
  'google-vertex',
  'google-gemini-cli',
  'ollama',
  'vllm',
  'lmstudio',
  'vercel-ai-gateway',
  'synthetic',
  'xiaomi',
  'kimi-coding',
  'chutes',
  'copilot-proxy',
  'kuae',
  'custom',
])

function emptyModelConfig(): ModelConfig {
  return {
    provider: 'anthropic',
    apiKey: '',
    modelId: 'claude-sonnet-4-6',
    moonshotRegion: 'global',
    customProviderId: '',
    customBaseUrl: '',
    customCompatibility: 'openai',
  }
}

function parseCloudflareBaseUrlFromProvider(
  baseUrl: string | undefined,
): { accountId?: string; gatewayId?: string } {
  if (!baseUrl) return {}
  const m = baseUrl.match(
    /^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/([^/]+)\/([^/]+)\//i,
  )
  if (!m) return {}
  return { accountId: m[1], gatewayId: m[2] }
}

/**
 * Best-effort reverse mapping from `openclaw.json` → wizard ModelConfig.
 * API keys are never returned (user must re-enter to rotate).
 */
export function inferModelConfigFromOpenClaw(config: OpenClawConfig): ModelConfig {
  const defaults = config.agents?.defaults?.model
  let primary =
    typeof defaults === 'string' ? defaults : defaults?.primary
  if (!primary?.trim()) {
    return emptyModelConfig()
  }
  primary = primary.trim()

  if (!primary.includes('/')) {
    return {
      ...emptyModelConfig(),
      provider: 'minimax',
      modelId: primary,
    }
  }

  const slash = primary.indexOf('/')
  const providerPart = primary.slice(0, slash)
  const modelPart = primary.slice(slash + 1)

  const moonshotBase = config.models?.providers?.moonshot?.baseUrl ?? ''
  let provider: ModelProvider
  if (providerPart === 'moonshot' && moonshotBase.includes('moonshot.cn')) {
    provider = 'moonshot-cn'
  } else if (KNOWN_PROVIDERS.has(providerPart as ModelProvider)) {
    provider = providerPart as ModelProvider
  } else {
    const customP = config.models?.providers?.[providerPart]
    return {
      provider: 'custom',
      apiKey: '',
      modelId: modelPart,
      moonshotRegion: 'global',
      customProviderId: providerPart,
      customBaseUrl: typeof customP?.baseUrl === 'string' ? customP.baseUrl : '',
      customCompatibility: customP?.api === 'anthropic-messages' ? 'anthropic' : 'openai',
    }
  }

  const moonshotRegion =
    provider === 'moonshot-cn' || moonshotBase.includes('moonshot.cn') ? 'cn' : 'global'

  let cloudflareAccountId: string | undefined
  let cloudflareGatewayId: string | undefined
  if (provider === 'cloudflare-ai-gateway') {
    const cf = parseCloudflareBaseUrlFromProvider(
      config.models?.providers?.['cloudflare-ai-gateway']?.baseUrl,
    )
    cloudflareAccountId = cf.accountId
    cloudflareGatewayId = cf.gatewayId
  }

  return {
    ...emptyModelConfig(),
    provider,
    modelId: modelPart,
    moonshotRegion,
    ...(cloudflareAccountId ? { cloudflareAccountId } : {}),
    ...(cloudflareGatewayId ? { cloudflareGatewayId } : {}),
  }
}

export function listAgentSummariesFromConfig(
  config: OpenClawConfig,
): Array<{ id: string; name?: string; currentModel?: string }> {
  const list = config.agents?.list
  if (!Array.isArray(list)) return []
  const out: Array<{ id: string; name?: string; currentModel?: string }> = []
  for (const a of list) {
    const o = a as Record<string, unknown>
    const id = String(o.id ?? '').trim()
    if (!id) continue
    const name = typeof o.name === 'string' ? o.name : undefined
    const m = o.model
    let currentModel: string | undefined
    if (typeof m === 'string') currentModel = m
    else if (m && typeof m === 'object' && m !== null && 'primary' in m) {
      currentModel = String((m as { primary?: string }).primary ?? '')
    }
    out.push({ id, ...(name !== undefined ? { name } : {}), ...(currentModel !== undefined ? { currentModel } : {}) })
  }
  return out
}
