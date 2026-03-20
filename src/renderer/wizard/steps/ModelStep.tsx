import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useWizardStore } from '@/stores/wizard-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getProviderAuthMode, requiresApiKey } from '@/utils/provider-auth'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react'
import type { ModelProvider } from '../../../shared/types'

// ─── Provider & Model Presets ────────────────────────────────────────────────

interface ProviderInfo {
  id: ModelProvider
  label: string
  placeholder: string
}

// Order matches OpenClaw CLI `openclaw onboard --auth-choice` options
const PROVIDERS: readonly ProviderInfo[] = [
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

interface ModelPreset {
  id: string
  label: string
}

const MODELS_BY_PROVIDER: Partial<Record<ModelProvider, readonly ModelPreset[]>> = {
  anthropic: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  ],
  openai: [
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
  ],
  'openai-codex': [
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  ],
  google: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { id: 'gemini-3.1-flash-preview', label: 'Gemini 3.1 Flash (Preview)' },
  ],
  openrouter: [{ id: 'auto', label: 'OpenRouter Auto' }],
  mistral: [{ id: 'mistral-large-latest', label: 'Mistral Large Latest' }],
  opencode: [{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }],
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
  minimax: [{ id: 'MiniMax-M2.5', label: 'MiniMax M2.5' }],
  zai: [{ id: 'glm-5', label: 'GLM-5' }],
  groq: [{ id: 'llama-3.3-70b', label: 'Llama 3.3 70B' }],
  xai: [{ id: 'grok-4', label: 'Grok 4' }],
  cerebras: [{ id: 'zai-glm-4.7', label: 'GLM 4.7 (Cerebras)' }],
  huggingface: [{ id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' }],
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
  ollama: [{ id: 'llama3.3', label: 'Llama 3.3' }],
  vllm: [{ id: 'your-model-id', label: 'Your model ID' }],
  lmstudio: [{ id: 'your-model-id', label: 'Your model ID' }],
  kuae: [{ id: 'GLM-4.7', label: 'GLM-4.7' }],
}

const CUSTOM_MODEL_OPTION = '__custom__'
const TESTABLE_PROVIDERS = new Set<ModelProvider>([
  'anthropic',
  'openai',
  'google',
  'moonshot',
  'moonshot-cn',
  'openrouter',
  'kuae',
  'custom',
])

// ─── Test result types ───────────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestState {
  status: TestStatus
  message: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ModelStep() {
  const { t } = useTranslation()
  const { modelConfig, setModelConfig } = useWizardStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    message: '',
  })
  const [useCustomModel, setUseCustomModel] = useState(() => {
    const presets = MODELS_BY_PROVIDER[modelConfig.provider]
    if (!presets) return true
    return !presets.some((m) => m.id === modelConfig.modelId) && modelConfig.modelId !== ''
  })

  const providerPresets = MODELS_BY_PROVIDER[modelConfig.provider]
  const hasPresets = Boolean(providerPresets)
  const authMode = getProviderAuthMode(modelConfig.provider)
  const apiKeyRequired = requiresApiKey(modelConfig.provider)

  const handleProviderChange = useCallback(
    (provider: ModelProvider) => {
      const presets = MODELS_BY_PROVIDER[provider]
      const nextAuthMode = getProviderAuthMode(provider)
      const shouldClearApiKey = nextAuthMode === 'oauth' || nextAuthMode === 'none'
      setModelConfig({
        provider,
        modelId: presets?.[0]?.id ?? '',
        ...(shouldClearApiKey ? { apiKey: '' } : {}),
        moonshotRegion: provider === 'moonshot-cn' ? 'cn' : provider === 'moonshot' ? modelConfig.moonshotRegion ?? 'global' : 'global',
        customProviderId: provider === 'custom' ? modelConfig.customProviderId ?? '' : '',
        customBaseUrl: provider === 'custom' ? modelConfig.customBaseUrl ?? '' : '',
        customCompatibility: provider === 'custom' ? modelConfig.customCompatibility ?? 'openai' : undefined,
        cloudflareAccountId: provider === 'cloudflare-ai-gateway' ? modelConfig.cloudflareAccountId ?? '' : '',
        cloudflareGatewayId: provider === 'cloudflare-ai-gateway' ? modelConfig.cloudflareGatewayId ?? '' : '',
      })
      setUseCustomModel(!presets)
      setTestState({ status: 'idle', message: '' })
    },
    [
      modelConfig.cloudflareAccountId,
      modelConfig.cloudflareGatewayId,
      modelConfig.customBaseUrl,
      modelConfig.customCompatibility,
      modelConfig.customProviderId,
      modelConfig.moonshotRegion,
      setModelConfig,
    ],
  )

  const handleModelSelect = useCallback(
    (value: string) => {
      if (value === CUSTOM_MODEL_OPTION) {
        setUseCustomModel(true)
        setModelConfig({ modelId: '' })
      } else {
        setUseCustomModel(false)
        setModelConfig({ modelId: value })
      }
      setTestState({ status: 'idle', message: '' })
    },
    [setModelConfig],
  )

  const handleTestConnection = useCallback(async () => {
    setTestState({ status: 'testing', message: '' })
    try {
      const result = await window.electronAPI.wizardTestModel(modelConfig)
      if (result.ok) {
        setTestState({ status: 'success', message: t('wizard.model.connectionSuccess') })
      } else {
        setTestState({
          status: 'error',
          message: result.message ?? t('wizard.model.connectionFailed'),
        })
      }
    } catch {
      setTestState({
        status: 'error',
        message: t('wizard.model.networkError'),
      })
    }
  }, [modelConfig, t])

  const canTest =
    modelConfig.provider &&
    modelConfig.modelId.trim() &&
    TESTABLE_PROVIDERS.has(modelConfig.provider) &&
    (modelConfig.provider !== 'custom' ||
      (modelConfig.apiKey.trim() &&
        modelConfig.customProviderId?.trim() &&
        modelConfig.customBaseUrl?.trim())) &&
    (!requiresApiKey(modelConfig.provider) || modelConfig.apiKey.trim())

  return (
    <div className="space-y-5 sm:space-y-6 max-w-2xl mx-auto">
      <header>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t('wizard.model.title')}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('wizard.model.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Provider */}
        <fieldset className="space-y-1.5">
          <label htmlFor="provider-select" className="text-sm font-medium">
            {t('wizard.model.provider')} <span className="text-destructive">*</span>
          </label>
          <Select
            value={modelConfig.provider}
            onValueChange={(v) => handleProviderChange(v as ModelProvider)}
          >
            <SelectTrigger id="provider-select" className="w-full">
              <SelectValue placeholder={t('wizard.model.selectProvider')} />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>

        {/* Model ID */}
        <fieldset className="space-y-1.5">
          <label htmlFor="model-id-input" className="text-sm font-medium">
            {t('wizard.model.defaultModel')} <span className="text-destructive">*</span>
          </label>

          {hasPresets && !useCustomModel ? (
            <Select
              value={modelConfig.modelId}
              onValueChange={handleModelSelect}
            >
              <SelectTrigger id="model-id-input" className="w-full">
                <SelectValue placeholder={t('wizard.model.selectModel')} />
              </SelectTrigger>
              <SelectContent>
                {providerPresets!.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_MODEL_OPTION}>{t('wizard.model.customModelId')}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Input
                id="model-id-input"
                type="text"
                value={modelConfig.modelId}
                onChange={(e) => {
                  setModelConfig({ modelId: e.target.value })
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder={
                  modelConfig.provider === 'openrouter'
                    ? 'anthropic/claude-sonnet-4-20250514'
                    : modelConfig.provider === 'custom'
                      ? 'provider/model-id'
                      : t('wizard.model.enterModelId')
                }
                className="font-mono"
              />
              {hasPresets && (
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomModel(false)
                    const firstPreset = providerPresets![0]
                    setModelConfig({ modelId: firstPreset.id })
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {t('wizard.model.backToPresets')}
                </button>
              )}
            </div>
          )}
        </fieldset>
      </div>

      {modelConfig.provider === 'moonshot' && (
        <fieldset className="space-y-1.5">
          <label htmlFor="moonshot-region-select" className="text-sm font-medium">
            {t('wizard.model.moonshotEndpoint')}
          </label>
          <Select
            value={modelConfig.moonshotRegion ?? 'global'}
            onValueChange={(v) => {
              setModelConfig({ moonshotRegion: v as 'global' | 'cn' })
              setTestState({ status: 'idle', message: '' })
            }}
          >
            <SelectTrigger id="moonshot-region-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">{t('wizard.model.moonshotGlobal')}</SelectItem>
              <SelectItem value="cn">{t('wizard.model.moonshotChina')}</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>
      )}

      {modelConfig.provider === 'cloudflare-ai-gateway' && (
        <fieldset className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label htmlFor="cloudflare-account-id" className="text-sm font-medium">
                Cloudflare Account ID <span className="text-destructive">*</span>
              </label>
              <Input
                id="cloudflare-account-id"
                type="text"
                value={modelConfig.cloudflareAccountId ?? ''}
                onChange={(e) => {
                  setModelConfig({ cloudflareAccountId: e.target.value })
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder="your-account-id"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cloudflare-gateway-id" className="text-sm font-medium">
                Cloudflare Gateway ID <span className="text-destructive">*</span>
              </label>
              <Input
                id="cloudflare-gateway-id"
                type="text"
                value={modelConfig.cloudflareGatewayId ?? ''}
                onChange={(e) => {
                  setModelConfig({ cloudflareGatewayId: e.target.value })
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder="your-gateway-id"
                className="font-mono"
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* API Key */}
      <fieldset className="space-y-1.5">
        <label htmlFor="api-key-input" className="text-sm font-medium">
          {t('wizard.model.apiKey')} {apiKeyRequired && <span className="text-destructive">*</span>}
        </label>
        <div className="relative">
          <Input
            id="api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={modelConfig.apiKey}
            onChange={(e) => {
              setModelConfig({ apiKey: e.target.value })
              setTestState({ status: 'idle', message: '' })
            }}
            placeholder={
              PROVIDERS.find((p) => p.id === modelConfig.provider)
                ?.placeholder ?? 'Enter API Key'
            }
            autoComplete="off"
            disabled={authMode === 'oauth' || authMode === 'none'}
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showApiKey ? t('wizard.model.hideApiKey') : t('wizard.model.showApiKey')}
          >
            {showApiKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {authMode === 'oauth' && (
          <p className="text-xs text-muted-foreground">
            {t('wizard.model.oauthHint')}
          </p>
        )}
        {authMode === 'none' && (
          <p className="text-xs text-muted-foreground">
            {t('wizard.model.noKeyHint')}
          </p>
        )}
        {(authMode === 'api_key' || authMode === 'optional') && (
          <p className="text-xs text-muted-foreground">
            {t('wizard.model.apiKeyStored')}
          </p>
        )}
      </fieldset>

      {/* Custom Provider Settings */}
      {modelConfig.provider === 'custom' && (
        <fieldset className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label htmlFor="custom-provider-id" className="text-sm font-medium">
                {t('wizard.model.providerId')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="custom-provider-id"
                type="text"
                value={modelConfig.customProviderId ?? ''}
                onChange={(e) => {
                  setModelConfig({ customProviderId: e.target.value })
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder="custom-provider"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="custom-base-url" className="text-sm font-medium">
                {t('wizard.model.apiBaseUrl')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="custom-base-url"
                type="text"
                value={modelConfig.customBaseUrl ?? ''}
                onChange={(e) => {
                  setModelConfig({ customBaseUrl: e.target.value })
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder="https://llm.example.com/v1"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-compatibility" className="text-sm font-medium">
              {t('wizard.model.compatibility')}
            </label>
            <Select
              value={modelConfig.customCompatibility ?? 'openai'}
              onValueChange={(v) =>
                setModelConfig({ customCompatibility: v as 'openai' | 'anthropic' })
              }
            >
              <SelectTrigger id="custom-compatibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              <SelectItem value="openai">{t('wizard.model.openaiCompatible')}</SelectItem>
              <SelectItem value="anthropic">{t('wizard.model.anthropicCompatible')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>
      )}

      {/* Test Connection */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTestConnection()}
            disabled={!canTest || testState.status === 'testing'}
          >
            {testState.status === 'testing' ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Zap />
            )}
            {testState.status === 'testing' ? t('wizard.model.testing') : t('wizard.model.testConnection')}
          </Button>

          {testState.status === 'success' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              {testState.message}
            </span>
          )}

          {testState.status === 'error' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
              <XCircle className="w-4 h-4" />
              {testState.message}
            </span>
          )}
        </div>

        {testState.status === 'idle' && canTest && (
          <p className="text-xs text-muted-foreground">
          {t('wizard.model.testHint')}
          </p>
        )}

        {testState.status === 'idle' && !TESTABLE_PROVIDERS.has(modelConfig.provider) && (
          <p className="text-xs text-muted-foreground">
          {t('wizard.model.noTestHint')}
          </p>
        )}
      </div>
    </div>
  )
}
