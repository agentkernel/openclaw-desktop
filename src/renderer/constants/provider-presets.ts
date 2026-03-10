/**
 * Provider 预设 — LLM API 管理页面与向导共用
 * 与 ModelStep 的 PROVIDERS/MODELS_BY_PROVIDER 保持同步
 */

import type { ModelProvider } from '../../shared/types'

export interface ProviderOption {
  id: ModelProvider
  label: string
  placeholder: string
}

export interface ModelPreset {
  id: string
  label: string
}

export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-proj-...' },
  { id: 'google', label: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'xai', label: 'xAI (Grok)', placeholder: 'xai-...' },
  { id: 'minimax', label: 'MiniMax', placeholder: 'minimax-...' },
  { id: 'moonshot', label: 'Moonshot (Kimi)', placeholder: 'moonshot-...' },
  { id: 'moonshot-cn', label: 'Moonshot (Kimi) 中国区', placeholder: 'moonshot-...' },
  { id: 'mistral', label: 'Mistral', placeholder: 'mistral-...' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
  { id: 'cerebras', label: 'Cerebras', placeholder: 'cbrs-...' },
  { id: 'huggingface', label: 'Hugging Face', placeholder: 'hf_...' },
  { id: 'cloudflare-ai-gateway', label: 'Cloudflare AI Gateway', placeholder: 'cf-...' },
  { id: 'vercel-ai-gateway', label: 'Vercel AI Gateway', placeholder: 'vercel-...' },
  { id: 'chutes', label: 'Chutes (OAuth)', placeholder: 'OAuth via CLI' },
  { id: 'copilot-proxy', label: 'Copilot Proxy (Local)', placeholder: 'http://localhost:3000/v1' },
  { id: 'ollama', label: 'Ollama (Local)', placeholder: 'llama3.3' },
  { id: 'vllm', label: 'vLLM (Local)', placeholder: 'your-model-id' },
  { id: 'litellm', label: 'LiteLLM', placeholder: 'llm-...' },
  { id: 'custom', label: 'Custom', placeholder: 'Enter API Key' },
] as const

export const MODELS_BY_PROVIDER: Partial<Record<ModelProvider, readonly ModelPreset[]>> = {
  anthropic: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  ],
  openai: [{ id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' }],
  google: [
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  ],
  openrouter: [{ id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }],
  opencode: [{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }],
  mistral: [{ id: 'mistral-large-latest', label: 'Mistral Large Latest' }],
  moonshot: [
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo' },
  ],
  'moonshot-cn': [
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo' },
  ],
  groq: [{ id: 'llama-3.3-70b', label: 'Llama 3.3 70B' }],
  xai: [{ id: 'grok-code-fast-1', label: 'Grok Code Fast 1' }],
  ollama: [{ id: 'llama3.3', label: 'Llama 3.3' }],
}
