import { useState, useEffect, useCallback } from 'react'
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShellLayout } from './ShellLayout'
import { PROVIDER_OPTIONS, MODELS_BY_PROVIDER } from '@/constants/provider-presets'
import type { ModelProvider, ModelConfig } from '../../shared/types'
import type { ProvidersListResult } from '../../shared/electron-api'

export interface ProviderViewProps {
  onBack?: () => void
}

function formatTestMessage(msg: string | undefined): string {
  if (!msg) return 'Unknown error'
  if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('unauthorized'))
    return 'Authentication failed. Check API key.'
  if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit'))
    return 'Rate limit reached. Try again later.'
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('econnrefused'))
    return 'Network error. Check connectivity.'
  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg
}

export function ProviderView({ onBack }: ProviderViewProps) {
  const [data, setData] = useState<ProvidersListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')
  const [newProfile, setNewProfile] = useState({ profileId: '', provider: '' as ModelProvider, apiKey: '' })
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [defaultPrimary, setDefaultPrimary] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.providersList()
      setData(res)
      setDefaultPrimary(res.modelDefaults?.primary ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleTest = async () => {
    const { provider, apiKey, modelId } = testForm
    if (!provider || !apiKey || !modelId) return
    if (provider === 'custom' && (!customBaseUrl || !customProviderId)) return
    setTestState('testing')
    setTestMessage('')
    try {
      const cfg: ModelConfig = {
        provider,
        apiKey,
        modelId,
        customBaseUrl: provider === 'custom' ? customBaseUrl : undefined,
        customProviderId: provider === 'custom' ? customProviderId : undefined,
        customCompatibility: provider === 'custom' ? 'openai' : undefined,
      }
      const res = await window.electronAPI.providersTest(cfg)
      if (res.ok) {
        setTestState('ok')
        setTestMessage('Connection successful')
      } else {
        setTestState('fail')
        setTestMessage(formatTestMessage(res.message))
      }
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : 'Test failed')
    }
  }

  const [testForm, setTestForm] = useState({
    provider: '' as ModelProvider | '',
    modelId: '',
    apiKey: '',
  })
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customProviderId, setCustomProviderId] = useState('')

  const testModelOpts = testForm.provider ? MODELS_BY_PROVIDER[testForm.provider] ?? [] : []

  const handleSaveProfile = async () => {
    const { profileId, provider, apiKey } = newProfile
    if (!profileId.trim() || !provider || !apiKey.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.providersSaveProfile({ profileId: profileId.trim(), provider, apiKey })
      setNewProfile({ profileId: '', provider: '' as ModelProvider, apiKey: '' })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await window.electronAPI.providersDeleteProfile({ profileId })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleExport = async () => {
    try {
      const json = await window.electronAPI.providersExport({ maskKeys: true })
      await navigator.clipboard.writeText(json)
      setImportResult({ imported: 0, errors: [] })
      setTimeout(() => setImportResult(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const handleImport = async () => {
    if (!importJson.trim()) return
    try {
      const res = await window.electronAPI.providersImport(importJson.trim())
      setImportResult(res)
      setImportJson('')
      void load()
    } catch (e) {
      setImportResult({ imported: 0, errors: [e instanceof Error ? e.message : 'Import failed'] })
    }
  }

  const handleSetDefault = async () => {
    if (!defaultPrimary.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.providersSetModelDefaults({ primary: defaultPrimary.trim() })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const defaultBack = () => {
    window.location.hash = ''
  }
  const onBackFn = onBack ?? defaultBack

  if (loading && !data) {
    return (
      <ShellLayout title="LLM API" onBack={onBackFn}>
        <p className="text-sm text-muted-foreground" role="status">
          Loading providers and profiles…
        </p>
      </ShellLayout>
    )
  }

  return (
    <ShellLayout title="LLM API" onBack={onBackFn}>
      <div className="flex flex-col gap-6 max-w-2xl">
        {error && (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Default model */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label="Default model">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">Default model</h2>
          </div>
          <div className="flex gap-2">
            <Input
              value={defaultPrimary}
              onChange={(e) => setDefaultPrimary(e.target.value)}
              placeholder="e.g. anthropic/claude-sonnet-4-5"
              className="font-mono text-sm"
            />
            <Button size="sm" onClick={handleSetDefault} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Set'}
            </Button>
          </div>
        </section>

        {/* Providers list */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label="Providers">
          <h2 className="text-sm font-medium mb-3">Providers</h2>
          {data?.providers && data.providers.length > 0 ? (
            <ul className="space-y-2">
              {data.providers.map((p) => (
                <li
                  key={p.providerId}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="font-medium">{p.providerId}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.baseUrl ?? 'default'} · {p.hasApiKey ? 'Key set' : 'No key'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No providers configured yet.</p>
          )}
        </section>

        {/* Auth profiles */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label="Auth profiles">
          <h2 className="text-sm font-medium mb-3">Auth profiles</h2>
          {data?.profiles && data.profiles.length > 0 ? (
            <ul className="space-y-2">
              {data.profiles.map((prof) => (
                <li
                  key={prof.profileId}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span>
                    <span className="font-medium">{prof.profileId}</span>
                    <span className="text-muted-foreground text-sm ml-2">({prof.provider})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {prof.hasKey ? 'Key set' : 'No key'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteProfile(prof.profileId)}
                      aria-label={`Delete ${prof.profileId}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No profiles yet. Add one below.</p>
          )}

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Add profile</p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Profile ID"
                value={newProfile.profileId}
                onChange={(e) => setNewProfile((p) => ({ ...p, profileId: e.target.value }))}
                className="w-32"
              />
              <Select
                value={newProfile.provider || undefined}
                onValueChange={(v) => setNewProfile((p) => ({ ...p, provider: (v || '') as ModelProvider }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="password"
                placeholder="API Key"
                value={newProfile.apiKey}
                onChange={(e) => setNewProfile((p) => ({ ...p, apiKey: e.target.value }))}
                className="w-48"
              />
              <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Test connection */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label="Test connection">
          <h2 className="text-sm font-medium mb-3">Test connection</h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Select
                value={testForm.provider || undefined}
                onValueChange={(v) =>
                  setTestForm((f) => ({
                    ...f,
                    provider: (v || '') as ModelProvider | '',
                    modelId: '',
                  }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {testForm.provider === 'custom' ? (
                <>
                  <Input
                    placeholder="Provider ID"
                    value={customProviderId}
                    onChange={(e) => setCustomProviderId(e.target.value)}
                    className="w-32"
                  />
                  <Input
                    placeholder="Base URL"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    className="w-48"
                  />
                </>
              ) : null}
              {testModelOpts.length > 0 ? (
                <Select
                  value={testForm.modelId && testModelOpts.some((m) => m.id === testForm.modelId) ? testForm.modelId : undefined}
                  onValueChange={(v) => setTestForm((f) => ({ ...f, modelId: v || '' }))}
                  disabled={!testForm.provider}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Model (preset)" />
                  </SelectTrigger>
                  <SelectContent>
                    {testModelOpts.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder={testModelOpts.length > 0 ? 'Or custom model ID' : 'Model ID'}
                value={testForm.modelId}
                onChange={(e) => setTestForm((f) => ({ ...f, modelId: e.target.value }))}
                className="w-48"
              />
              <Input
                type="password"
                placeholder="API Key"
                value={testForm.apiKey}
                onChange={(e) => setTestForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-48"
              />
              <Button
                size="sm"
                onClick={handleTest}
                disabled={
                  testState === 'testing' ||
                  !testForm.provider ||
                  !testForm.apiKey ||
                  !testForm.modelId ||
                  (testForm.provider === 'custom' && (!customBaseUrl || !customProviderId))
                }
              >
                {testState === 'testing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            {testState === 'ok' && (
              <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" role="status">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                {testMessage}
              </p>
            )}
            {testState === 'fail' && (
              <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
                <XCircle className="w-4 h-4" aria-hidden />
                {testMessage}
              </p>
            )}
          </div>
        </section>

        {/* Import / Export */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label="Import and export">
          <h2 className="text-sm font-medium mb-3">Import / Export</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Copy className="w-4 h-4 mr-1" aria-hidden />
              Export (copy)
            </Button>
          </div>
          <div className="mt-3">
            <textarea
              className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste JSON to import…"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <Button size="sm" className="mt-2" onClick={handleImport} disabled={!importJson.trim()}>
              <Upload className="w-4 h-4 mr-1" aria-hidden />
              Import
            </Button>
            {importResult && (
              <p className="text-sm mt-2">
                Imported {importResult.imported}.{' '}
                {importResult.errors.length > 0 && (
                  <span className="text-destructive">{importResult.errors.join(', ')}</span>
                )}
              </p>
            )}
          </div>
        </section>
      </div>
    </ShellLayout>
  )
}
