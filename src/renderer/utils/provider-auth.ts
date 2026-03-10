import type { ModelProvider } from '../../shared/types'

export type ProviderAuthMode = 'api_key' | 'oauth' | 'none' | 'optional'

const AUTH_MODE_BY_PROVIDER: Record<ModelProvider, ProviderAuthMode> = {
  anthropic: 'api_key',
  openai: 'api_key',
  'openai-codex': 'oauth',
  google: 'api_key',
  openrouter: 'api_key',
  opencode: 'api_key',
  mistral: 'api_key',
  minimax: 'api_key',
  moonshot: 'api_key',
  'moonshot-cn': 'api_key',
  zai: 'api_key',
  venice: 'api_key',
  groq: 'api_key',
  xai: 'api_key',
  cerebras: 'api_key',
  huggingface: 'api_key',
  'github-copilot': 'oauth',
  kilocode: 'api_key',
  volcengine: 'api_key',
  'volcengine-plan': 'api_key',
  byteplus: 'api_key',
  'byteplus-plan': 'api_key',
  qianfan: 'api_key',
  bedrock: 'none',
  'cloudflare-ai-gateway': 'api_key',
  litellm: 'api_key',
  together: 'api_key',
  nvidia: 'api_key',
  'qwen-portal': 'oauth',
  'google-vertex': 'none',
  'google-antigravity': 'oauth',
  'google-gemini-cli': 'oauth',
  ollama: 'none',
  vllm: 'api_key',
  lmstudio: 'none',
  'vercel-ai-gateway': 'api_key',
  synthetic: 'api_key',
  xiaomi: 'api_key',
  'kimi-coding': 'api_key',
  chutes: 'oauth',
  'copilot-proxy': 'none',
  custom: 'api_key',
}

export function getProviderAuthMode(provider: ModelProvider): ProviderAuthMode {
  return AUTH_MODE_BY_PROVIDER[provider] ?? 'api_key'
}

export function requiresApiKey(provider: ModelProvider): boolean {
  const mode = getProviderAuthMode(provider)
  return mode === 'api_key' || mode === 'optional'
}
