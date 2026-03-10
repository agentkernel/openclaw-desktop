/**
 * 模型连接测试器 — 向各 Provider API 发送轻量测试请求
 * 支持 Anthropic / OpenAI / OpenAI Codex / Google(Gemini) / OpenRouter / Custom
 */

import type { ModelConfig } from '../../shared/types.js'

export interface WizardTestModelResult {
  ok: boolean
  message?: string
}

const REQUEST_TIMEOUT_MS = 15_000

interface ProviderTestConfig {
  url: string | ((model: string) => string)
  headers: (apiKey: string) => Record<string, string>
  body: (model: string) => unknown
  parseError?: (status: number, body: unknown) => string | undefined
}

const PROVIDER_CONFIGS: Record<string, ProviderTestConfig> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },

  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },

  'openai-codex': {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },

  google: {
    url: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: () => ({ 'content-type': 'application/json' }),
    body: () => ({
      contents: [{ parts: [{ text: 'hi' }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  },

  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },

  moonshot: {
    url: (_model) => 'https://api.moonshot.ai/v1/chat/completions',
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },
  'moonshot-cn': {
    url: (_model) => 'https://api.moonshot.cn/v1/chat/completions',
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  },
}

function joinBaseUrl(baseUrl: string, pathSuffix: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return `${trimmed}${pathSuffix}`
}

function buildCustomProviderConfig(
  baseUrl: string,
  compatibility: 'openai' | 'anthropic',
): ProviderTestConfig {
  if (compatibility === 'anthropic') {
    return {
      url: joinBaseUrl(baseUrl, '/messages'),
      headers: (apiKey) => ({
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      }),
      body: (model) => ({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    }
  }

  return {
    url: joinBaseUrl(baseUrl, '/chat/completions'),
    headers: (apiKey) => ({
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }),
    body: (model) => ({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  }
}

function resolveErrorMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return 'API Key 无效或无权限'
  }
  if (status === 429) {
    return '请求频率受限，请稍后重试'
  }
  if (status === 404) {
    return '模型不存在或不可用'
  }

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const errMsg =
      (obj.error as Record<string, unknown>)?.message ??
      (obj.error as Record<string, unknown>)?.type ??
      obj.message
    if (typeof errMsg === 'string') {
      return errMsg
    }
  }

  return `请求失败 (HTTP ${status})`
}

export async function testModelConnection(
  config: ModelConfig,
): Promise<WizardTestModelResult> {
  if (!config.provider || !config.apiKey?.trim() || !config.modelId?.trim()) {
    return { ok: false, message: '请填写完整的模型配置' }
  }

  if (config.provider === 'custom') {
    const baseUrl = config.customBaseUrl?.trim()
    const compatibility = config.customCompatibility ?? 'openai'
    if (!baseUrl) {
      return { ok: false, message: '请填写自定义 Provider 的 Base URL' }
    }
    if (!config.customProviderId?.trim()) {
      return { ok: false, message: '请填写自定义 Provider 的 ID' }
    }
    const providerConfig = buildCustomProviderConfig(baseUrl, compatibility)
    return runTestRequest(providerConfig, config)
  }

  const providerConfig = PROVIDER_CONFIGS[config.provider]
  if (!providerConfig) {
    return { ok: false, message: `该提供商暂不支持自动测试: ${config.provider}` }
  }

  return runTestRequest(providerConfig, config)
}

async function runTestRequest(
  providerConfig: ProviderTestConfig,
  config: ModelConfig,
): Promise<WizardTestModelResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let url: string
    if (typeof providerConfig.url === 'function') {
      url = providerConfig.url(config.modelId)
    } else {
      url = providerConfig.url
    }

    if ((config.provider === 'moonshot' && config.moonshotRegion === 'cn') || config.provider === 'moonshot-cn') {
      url = 'https://api.moonshot.cn/v1/chat/completions'
    }

    if (config.provider === 'google') {
      url += `?key=${encodeURIComponent(config.apiKey)}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: providerConfig.headers(config.apiKey),
      body: JSON.stringify(providerConfig.body(config.modelId)),
      signal: controller.signal,
    })

    if (response.ok) {
      return { ok: true, message: '连接成功' }
    }

    let responseBody: unknown
    try {
      responseBody = await response.json()
    } catch {
      responseBody = undefined
    }

    return {
      ok: false,
      message: resolveErrorMessage(response.status, responseBody),
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, message: '连接超时，请检查网络或代理设置' }
    }
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('fetch failed') || message.includes('ENOTFOUND')) {
      return { ok: false, message: '网络连接失败，请检查网络设置' }
    }
    return { ok: false, message: `连接失败: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }
}
