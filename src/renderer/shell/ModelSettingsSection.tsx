import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  Cpu,
  ExternalLink,
} from 'lucide-react'
import type { ModelConfig, ModelProvider, ModelSettingsLoadResult } from '../../shared/types'
import { PROVIDER_OPTIONS, MODELS_BY_PROVIDER } from '@/constants/provider-presets'

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

type TargetKind = 'defaults' | 'agent'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export function ModelSettingsSection() {
  const { t } = useTranslation()
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ModelSettingsLoadResult | null>(null)

  const [modelConfig, setModelConfig] = useState<ModelConfig>(() => ({
    provider: 'anthropic',
    apiKey: '',
    modelId: 'claude-sonnet-4-6',
    moonshotRegion: 'global',
    customProviderId: '',
    customBaseUrl: '',
    customCompatibility: 'openai',
  }))

  const [targetKind, setTargetKind] = useState<TargetKind>('defaults')
  const [agentId, setAgentId] = useState('')
  const [restartGateway, setRestartGateway] = useState(true)

  const [showApiKey, setShowApiKey] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [testState, setTestState] = useState<{ status: TestStatus; message: string }>({
    status: 'idle',
    message: '',
  })

  const [saving, setSaving] = useState(false)
  const [saveBanner, setSaveBanner] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const res = await window.electronAPI.modelSettingsLoad()
      setSnapshot(res)
      setModelConfig(res.modelConfig)
      const agents = res.agents ?? []
      if (agents.length > 0) {
        setAgentId((id) => (id && agents.some((a) => a.id === id) ? id : agents[0]!.id))
      } else {
        setTargetKind('defaults')
        setAgentId('')
      }
      const presets = MODELS_BY_PROVIDER[res.modelConfig.provider]
      const customModel =
        !presets || !presets.some((m) => m.id === res.modelConfig.modelId) && res.modelConfig.modelId !== ''
      setUseCustomModel(customModel)
      setLoadState('ok')
    } catch (e) {
      setLoadState('error')
      setLoadError(e instanceof Error ? e.message : t('shell.settings.modelLoadFailed'))
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const providerPresets = MODELS_BY_PROVIDER[modelConfig.provider]
  const hasPresets = Boolean(providerPresets)
  const authMode = getProviderAuthMode(modelConfig.provider)

  const handleProviderChange = useCallback(
    (provider: ModelProvider) => {
      const presets = MODELS_BY_PROVIDER[provider]
      const nextAuthMode = getProviderAuthMode(provider)
      const shouldClearApiKey = nextAuthMode === 'oauth' || nextAuthMode === 'none'
      setModelConfig({
        provider,
        modelId: presets?.[0]?.id ?? '',
        apiKey: shouldClearApiKey ? '' : modelConfig.apiKey,
        moonshotRegion:
          provider === 'moonshot-cn' ? 'cn' : provider === 'moonshot' ? modelConfig.moonshotRegion ?? 'global' : 'global',
        customProviderId: provider === 'custom' ? modelConfig.customProviderId ?? '' : '',
        customBaseUrl: provider === 'custom' ? modelConfig.customBaseUrl ?? '' : '',
        customCompatibility: provider === 'custom' ? modelConfig.customCompatibility ?? 'openai' : undefined,
        cloudflareAccountId: provider === 'cloudflare-ai-gateway' ? modelConfig.cloudflareAccountId ?? '' : '',
        cloudflareGatewayId: provider === 'cloudflare-ai-gateway' ? modelConfig.cloudflareGatewayId ?? '' : '',
      })
      setUseCustomModel(!presets)
      setTestState({ status: 'idle', message: '' })
      setSaveBanner(null)
    },
    [
      modelConfig.apiKey,
      modelConfig.cloudflareAccountId,
      modelConfig.cloudflareGatewayId,
      modelConfig.customBaseUrl,
      modelConfig.customProviderId,
      modelConfig.moonshotRegion,
    ],
  )

  const handleModelSelect = useCallback((value: string) => {
    if (value === CUSTOM_MODEL_OPTION) {
      setUseCustomModel(true)
      setModelConfig((m) => ({ ...m, modelId: '' }))
    } else {
      setUseCustomModel(false)
      setModelConfig((m) => ({ ...m, modelId: value }))
    }
    setTestState({ status: 'idle', message: '' })
    setSaveBanner(null)
  }, [])

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

  const getProviderOptionLabel = useCallback(
    (p: (typeof PROVIDER_OPTIONS)[number]) => {
      if (p.id === 'custom') {
        return t('wizard.model.provider.customLabel')
      }
      return t(`wizard.model.providerNames.${p.id}`, { defaultValue: p.label })
    },
    [t],
  )

  const currentPlaceholder =
    modelConfig.provider === 'custom'
      ? t('wizard.model.provider.customPlaceholder')
      : PROVIDER_OPTIONS.find((p) => p.id === modelConfig.provider)?.placeholder ?? 'API Key'

  const agents = snapshot?.agents ?? []
  const hasAgents = agents.length > 0

  const canSave = useMemo(() => {
    if (!modelConfig.modelId.trim()) return false
    if (modelConfig.provider === 'custom') {
      if (!modelConfig.customProviderId?.trim() || !modelConfig.customBaseUrl?.trim()) return false
    }
    if (modelConfig.provider === 'cloudflare-ai-gateway') {
      if (!modelConfig.cloudflareAccountId?.trim() || !modelConfig.cloudflareGatewayId?.trim()) return false
    }
    if (targetKind === 'agent' && !agentId.trim()) return false
    return true
  }, [modelConfig, targetKind, agentId])

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setSaveBanner(null)
    try {
      const result = await window.electronAPI.modelSettingsApply({
        modelConfig,
        target:
          targetKind === 'defaults' ? { kind: 'defaults' } : { kind: 'agent', agentId: agentId.trim() },
        restartGateway,
      })
      if (result.validationIssues?.length) {
        const detail = result.validationIssues.map((i) => `${i.path}: ${i.message}`).join('; ')
        setSaveBanner({
          kind: 'warn',
          text: t('shell.settings.modelValidationWarn', { detail }),
        })
      } else {
        setSaveBanner({
          kind: 'ok',
          text: result.restarted
            ? t('shell.settings.modelSavedRestarted')
            : t('shell.settings.modelSaved'),
        })
      }
      void load()
    } catch (e) {
      setSaveBanner({
        kind: 'err',
        text: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <section
        className="rounded-lg border border-border bg-card p-4"
        aria-label={t('shell.settings.modelSectionAria')}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
          {t('shell.settings.loading')}
        </div>
      </section>
    )
  }

  if (loadState === 'error' || !snapshot) {
    return (
      <section
        className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
        role="alert"
        aria-label={t('shell.settings.modelSectionAria')}
      >
        <p className="text-sm text-destructive">{loadError ?? t('shell.settings.loadFailed')}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          {t('shell.feishu.refresh')}
        </Button>
      </section>
    )
  }

  if (!snapshot.hasConfig) {
    return (
      <section
        className="rounded-lg border border-border bg-card p-4"
        aria-label={t('shell.settings.modelSectionAria')}
      >
        <div className="flex items-start gap-2">
          <Cpu className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('shell.settings.modelNoConfig')}</p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 flex flex-col gap-5"
      aria-label={t('shell.settings.modelSectionAria')}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-medium">{t('shell.settings.modelSection')}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t('shell.settings.modelSectionDesc')}</p>
        {snapshot.defaultPrimaryDisplay ? (
          <p className="text-xs text-muted-foreground font-mono break-all">
            {t('shell.settings.modelCurrentPrimary', { primary: snapshot.defaultPrimaryDisplay })}
          </p>
        ) : null}
      </div>

      {saveBanner && (
        <div
          role="status"
          className={`text-sm rounded-md px-3 py-2 ${
            saveBanner.kind === 'ok'
              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
              : saveBanner.kind === 'warn'
                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200'
                : 'bg-destructive/10 text-destructive'
          }`}
        >
          {saveBanner.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <fieldset className="space-y-1.5">
          <label className="text-sm font-medium">{t('shell.settings.modelTarget')}</label>
          <Select
            value={targetKind}
            onValueChange={(v) => {
              setTargetKind(v as TargetKind)
              setSaveBanner(null)
              if (v === 'agent' && agents.length > 0 && !agentId) {
                setAgentId(agents[0]!.id)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="defaults">{t('shell.settings.modelTargetDefaults')}</SelectItem>
              <SelectItem value="agent" disabled={!hasAgents}>
                {t('shell.settings.modelTargetAgent')}
              </SelectItem>
            </SelectContent>
          </Select>
          {!hasAgents ? (
            <p className="text-xs text-muted-foreground">{t('shell.settings.modelNoAgents')}</p>
          ) : null}
        </fieldset>

        {targetKind === 'agent' && hasAgents ? (
          <fieldset className="space-y-1.5">
            <label className="text-sm font-medium">{t('shell.settings.modelSelectAgent')}</label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ? `${a.name} (${a.id})` : a.id}
                    {a.currentModel
                      ? ` — ${t('shell.settings.modelAgentCurrent', { model: a.currentModel })}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <fieldset className="space-y-1.5">
          <label htmlFor="settings-provider-select" className="text-sm font-medium">
            {t('wizard.model.providerTitle')} <span className="text-destructive">*</span>
          </label>
          <Select
            value={modelConfig.provider}
            onValueChange={(v) => handleProviderChange(v as ModelProvider)}
          >
            <SelectTrigger id="settings-provider-select" className="w-full">
              <SelectValue placeholder={t('wizard.model.selectProvider')} />
            </SelectTrigger>
            <SelectContent className="max-h-[min(60vh,320px)]">
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {getProviderOptionLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>

        <fieldset className="space-y-1.5">
          <label htmlFor="settings-model-id" className="text-sm font-medium">
            {t('wizard.model.defaultModel')} <span className="text-destructive">*</span>
          </label>
          {hasPresets && !useCustomModel ? (
            <Select value={modelConfig.modelId} onValueChange={handleModelSelect}>
              <SelectTrigger id="settings-model-id" className="w-full">
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
                id="settings-model-id"
                type="text"
                value={modelConfig.modelId}
                onChange={(e) => {
                  setModelConfig((m) => ({ ...m, modelId: e.target.value }))
                  setTestState({ status: 'idle', message: '' })
                  setSaveBanner(null)
                }}
                placeholder={t('wizard.model.enterModelId')}
                className="font-mono"
              />
              {hasPresets ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomModel(false)
                    const first = providerPresets![0]
                    if (first) setModelConfig((m) => ({ ...m, modelId: first.id }))
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {t('wizard.model.backToPresets')}
                </button>
              ) : null}
            </div>
          )}
        </fieldset>
      </div>

      {modelConfig.provider === 'moonshot' && (
        <fieldset className="space-y-1.5">
          <label htmlFor="settings-moonshot-region" className="text-sm font-medium">
            {t('wizard.model.moonshotEndpoint')}
          </label>
          <Select
            value={modelConfig.moonshotRegion ?? 'global'}
            onValueChange={(v) => {
              setModelConfig((m) => ({ ...m, moonshotRegion: v as 'global' | 'cn' }))
              setTestState({ status: 'idle', message: '' })
            }}
          >
            <SelectTrigger id="settings-moonshot-region" className="w-full">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <fieldset className="space-y-1.5">
            <label htmlFor="settings-cf-account" className="text-sm font-medium">
              Cloudflare Account ID <span className="text-destructive">*</span>
            </label>
            <Input
              id="settings-cf-account"
              value={modelConfig.cloudflareAccountId ?? ''}
              onChange={(e) =>
                setModelConfig((m) => ({ ...m, cloudflareAccountId: e.target.value }))
              }
              className="font-mono"
              placeholder="account-id"
            />
          </fieldset>
          <fieldset className="space-y-1.5">
            <label htmlFor="settings-cf-gateway" className="text-sm font-medium">
              Cloudflare Gateway ID <span className="text-destructive">*</span>
            </label>
            <Input
              id="settings-cf-gateway"
              value={modelConfig.cloudflareGatewayId ?? ''}
              onChange={(e) =>
                setModelConfig((m) => ({ ...m, cloudflareGatewayId: e.target.value }))
              }
              className="font-mono"
              placeholder="gateway-id"
            />
          </fieldset>
        </div>
      )}

      <fieldset className="space-y-1.5">
        <label htmlFor="settings-api-key" className="text-sm font-medium">
          {t('wizard.model.apiKey')}
        </label>
        <div className="relative">
          <Input
            id="settings-api-key"
            type={showApiKey ? 'text' : 'password'}
            value={modelConfig.apiKey}
            onChange={(e) => {
              setModelConfig((m) => ({ ...m, apiKey: e.target.value }))
              setTestState({ status: 'idle', message: '' })
              setSaveBanner(null)
            }}
            placeholder={currentPlaceholder}
            autoComplete="off"
            disabled={authMode === 'oauth' || authMode === 'none'}
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label={showApiKey ? t('wizard.model.hideApiKey') : t('wizard.model.showApiKey')}
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('shell.settings.modelApiKeyHint')}</p>
        {authMode === 'oauth' && (
          <p className="text-xs text-muted-foreground">{t('wizard.model.oauthHint')}</p>
        )}
        {authMode === 'none' && (
          <p className="text-xs text-muted-foreground">{t('wizard.model.noKeyHint')}</p>
        )}
      </fieldset>

      {modelConfig.provider === 'custom' && (
        <fieldset className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="settings-custom-pid" className="text-sm font-medium">
                {t('wizard.model.providerId')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="settings-custom-pid"
                value={modelConfig.customProviderId ?? ''}
                onChange={(e) =>
                  setModelConfig((m) => ({ ...m, customProviderId: e.target.value }))
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-custom-url" className="text-sm font-medium">
                {t('wizard.model.apiBaseUrl')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="settings-custom-url"
                value={modelConfig.customBaseUrl ?? ''}
                onChange={(e) =>
                  setModelConfig((m) => ({ ...m, customBaseUrl: e.target.value }))
                }
                className="font-mono"
                placeholder="https://"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="settings-custom-compat" className="text-sm font-medium">
              {t('wizard.model.compatibility')}
            </label>
            <Select
              value={modelConfig.customCompatibility ?? 'openai'}
              onValueChange={(v) =>
                setModelConfig((m) => ({
                  ...m,
                  customCompatibility: v as 'openai' | 'anthropic',
                }))
              }
            >
              <SelectTrigger id="settings-custom-compat" className="w-full">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleTestConnection()}
          disabled={!canTest || testState.status === 'testing'}
        >
          {testState.status === 'testing' ? (
            <Loader2 className="animate-spin w-4 h-4" aria-hidden />
          ) : (
            <Zap className="w-4 h-4" aria-hidden />
          )}
          {testState.status === 'testing' ? t('wizard.model.testing') : t('wizard.model.testConnection')}
        </Button>
        {testState.status === 'success' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" aria-hidden />
            {testState.message}
          </span>
        )}
        {testState.status === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="w-4 h-4" aria-hidden />
            {testState.message}
          </span>
        )}
      </div>

      <fieldset className="space-y-2">
        <span className="text-sm font-medium">{t('shell.settings.modelApplyTiming')}</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant={restartGateway ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRestartGateway(true)}
            className="justify-start sm:justify-center"
          >
            {t('shell.settings.modelApplyRestart')}
          </Button>
          <Button
            type="button"
            variant={!restartGateway ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRestartGateway(false)}
            className="justify-start sm:justify-center"
          >
            {t('shell.settings.modelApplyDeferred')}
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" onClick={() => void handleSave()} disabled={!canSave || saving}>
          {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" aria-hidden /> : null}
          {saving ? t('shell.settings.modelSaving') : t('shell.settings.modelSave')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            window.location.hash = '#llm-api'
          }}
        >
          <ExternalLink className="w-4 h-4 mr-1" aria-hidden />
          {t('shell.settings.modelOpenLlmApi')}
        </Button>
      </div>
    </section>
  )
}
