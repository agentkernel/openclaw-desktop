/**
 * Provider presets — shared by LLM API settings and wizard.
 * Keep in sync with ModelStep PROVIDERS / MODELS_BY_PROVIDER.
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
  { id: 'openai-codex', label: 'OpenAI Codex (OAuth)', placeholder: 'OAuth via CLI' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-proj-...' },
  { id: 'google', label: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'xai', label: 'xAI (Grok)', placeholder: 'xai-...' },
  { id: 'opencode', label: 'OpenCode Zen', placeholder: 'opencode-...' },
  { id: 'vercel-ai-gateway', label: 'Vercel AI Gateway', placeholder: 'vercel-...' },
  { id: 'cloudflare-ai-gateway', label: 'Cloudflare AI Gateway', placeholder: 'cf-...' },
  { id: 'minimax', label: 'MiniMax', placeholder: 'minimax-...' },
  { id: 'synthetic', label: 'Synthetic', placeholder: 'synthetic-...' },
  { id: 'moonshot', label: 'Moonshot (Kimi) Global', placeholder: 'moonshot-...' },
  { id: 'moonshot-cn', label: 'Moonshot (Kimi) China', placeholder: 'moonshot-...' },
  { id: 'kimi-coding', label: 'Kimi Coding', placeholder: 'kimi-...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'mistral', label: 'Mistral', placeholder: 'mistral-...' },
  { id: 'zai', label: 'Z.AI', placeholder: 'zai-...' },
  { id: 'huggingface', label: 'Hugging Face', placeholder: 'hf_...' },
  { id: 'chutes', label: 'Chutes (OAuth)', placeholder: 'OAuth via CLI' },
  { id: 'copilot-proxy', label: 'Copilot Proxy (Local)', placeholder: 'http://localhost:3000/v1' },
  { id: 'github-copilot', label: 'GitHub Copilot', placeholder: 'gho_...' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
  { id: 'cerebras', label: 'Cerebras', placeholder: 'cbrs-...' },
  { id: 'kilocode', label: 'Kilo Gateway', placeholder: 'kilo-...' },
  { id: 'venice', label: 'Venice', placeholder: 'venice-...' },
  { id: 'google-vertex', label: 'Google Vertex', placeholder: 'Uses gcloud ADC' },
  { id: 'google-antigravity', label: 'Google Antigravity', placeholder: 'OAuth via CLI' },
  { id: 'google-gemini-cli', label: 'Google Gemini CLI', placeholder: 'OAuth via CLI' },
  { id: 'volcengine', label: 'Volcano Engine (Doubao)', placeholder: 'volc-...' },
  { id: 'volcengine-plan', label: 'Volcengine (Coding)', placeholder: 'volc-...' },
  { id: 'byteplus', label: 'BytePlus', placeholder: 'byteplus-...' },
  { id: 'byteplus-plan', label: 'BytePlus (Coding)', placeholder: 'byteplus-...' },
  { id: 'qianfan', label: 'Qianfan', placeholder: 'qianfan-...' },
  { id: 'bedrock', label: 'Amazon Bedrock', placeholder: 'AWS credentials' },
  { id: 'litellm', label: 'LiteLLM (Unified Gateway)', placeholder: 'llm-...' },
  { id: 'together', label: 'Together AI', placeholder: 'tg_...' },
  { id: 'nvidia', label: 'NVIDIA', placeholder: 'nv-...' },
  { id: 'qwen-portal', label: 'Qwen Portal (OAuth)', placeholder: 'OAuth via CLI' },
  { id: 'ollama', label: 'Ollama (Local)', placeholder: 'llama3.3' },
  { id: 'vllm', label: 'vLLM (Local)', placeholder: 'your-model-id' },
  { id: 'lmstudio', label: 'LM Studio (Local)', placeholder: 'your-model-id' },
  { id: 'xiaomi', label: 'Xiaomi MiMo', placeholder: 'xiaomi-...' },
  { id: 'kuae', label: 'Kuae (Coding Plan)', placeholder: 'your_api_key' },
  { id: 'custom', label: 'Custom (OpenAI/Anthropic Compatible)', placeholder: 'Enter API Key' },
] as const

export const MODELS_BY_PROVIDER: Partial<Record<ModelProvider, readonly ModelPreset[]>> = {
  anthropic: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  ],
  openai: [{ id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' }],
  'openai-codex': [{ id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' }],
  google: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { id: 'gemini-3.1-flash-preview', label: 'Gemini 3.1 Flash (Preview)' },
  ],
  openrouter: [{ id: 'auto', label: 'OpenRouter Auto' }],
  opencode: [{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }],
  mistral: [{ id: 'mistral-large-latest', label: 'Mistral Large Latest' }],
  minimax: [{ id: 'MiniMax-M2.5', label: 'MiniMax M2.5' }],
  moonshot: [
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-0905-preview', label: 'Kimi K2 0905 Preview' },
    { id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo' },
    { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { id: 'kimi-k2-thinking-turbo', label: 'Kimi K2 Thinking Turbo' },
  ],
  'moonshot-cn': [
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-0905-preview', label: 'Kimi K2 0905 Preview' },
    { id: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo' },
    { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { id: 'kimi-k2-thinking-turbo', label: 'Kimi K2 Thinking Turbo' },
  ],
  'kimi-coding': [{ id: 'k2p5', label: 'Kimi Coding K2P5' }],
  zai: [{ id: 'glm-5', label: 'GLM-5' }],
  groq: [{ id: 'llama-3.3-70b', label: 'Llama 3.3 70B' }],
  xai: [{ id: 'grok-4', label: 'Grok 4' }],
  kilocode: [{ id: 'kilo/auto', label: 'Kilo Auto (Smart Routing)' }],
  volcengine: [
    { id: 'doubao-seed-1-8-251228', label: 'Doubao Seed 1.8' },
    { id: 'doubao-seed-code-preview-251028', label: 'Doubao Seed Code Preview' },
    { id: 'kimi-k2-5-260127', label: 'Kimi K2.5' },
    { id: 'glm-4-7-251222', label: 'GLM 4.7' },
    { id: 'deepseek-v3-2-251201', label: 'DeepSeek V3.2 128K' },
  ],
  'volcengine-plan': [
    { id: 'ark-code-latest', label: 'ARK Code Latest' },
    { id: 'doubao-seed-code', label: 'Doubao Seed Code' },
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { id: 'glm-4.7', label: 'GLM 4.7' },
  ],
  byteplus: [
    { id: 'seed-1-8-251228', label: 'Seed 1.8' },
    { id: 'kimi-k2-5-260127', label: 'Kimi K2.5' },
    { id: 'glm-4-7-251222', label: 'GLM 4.7' },
  ],
  'byteplus-plan': [
    { id: 'ark-code-latest', label: 'ARK Code Latest' },
    { id: 'doubao-seed-code', label: 'Doubao Seed Code' },
    { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { id: 'glm-4.7', label: 'GLM 4.7' },
  ],
  qianfan: [{ id: 'deepseek-v3.2', label: 'DeepSeek V3.2' }],
  bedrock: [{ id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', label: 'Claude 3.5 Sonnet' }],
  together: [{ id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' }],
  nvidia: [{ id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'NVIDIA Llama 3.1 Nemotron 70B' }],
  xiaomi: [{ id: 'mimo-7b', label: 'MiMo 7B' }],
  chutes: [{ id: 'chutes-default', label: 'Chutes Default' }],
  'vercel-ai-gateway': [{ id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' }],
  'cloudflare-ai-gateway': [{ id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }],
  'copilot-proxy': [
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
    { id: 'gpt-5.1', label: 'GPT-5.1' },
    { id: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1' },
  ],
  litellm: [{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }],
  cerebras: [{ id: 'zai-glm-4.7', label: 'GLM 4.7 (Cerebras)' }],
  huggingface: [{ id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' }],
  ollama: [{ id: 'llama3.3', label: 'Llama 3.3' }],
  vllm: [{ id: 'your-model-id', label: 'Your model ID' }],
  lmstudio: [{ id: 'your-model-id', label: 'Your model ID' }],
  kuae: [{ id: 'GLM-4.7', label: 'GLM-4.7' }],
}
