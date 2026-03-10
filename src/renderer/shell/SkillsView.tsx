import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Puzzle,
  Search,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FolderOpen,
  ChevronRight,
  Package,
  Filter,
  FileText,
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
import type {
  SkillRegistryItem,
  ExtensionRegistryItem,
  ValidationResult,
} from '../../shared/types'

export interface SkillsViewProps {
  onBack?: () => void
}

type TabType = 'skills' | 'extensions'
type SourceFilter = 'all' | 'bundled' | 'user'
type StatusFilter = 'all' | 'enabled' | 'disabled' | 'error'

interface SkillDetailState {
  kind: 'skill' | 'extension'
  item: SkillRegistryItem | ExtensionRegistryItem
  validation: ValidationResult | null
  validating: boolean
}

function getSourceBadge(source: string) {
  const colors: Record<string, string> = {
    bundled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'user-workspace': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'user-extensions': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'load-path': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }
  return colors[source] ?? 'bg-muted text-muted-foreground'
}

function isExtension(item: SkillRegistryItem | ExtensionRegistryItem): item is ExtensionRegistryItem {
  return 'providers' in item || 'tools' in item || 'commands' in item
}

export function SkillsView({ onBack }: SkillsViewProps) {
  const [tab, setTab] = useState<TabType>('skills')
  const [skills, setSkills] = useState<SkillRegistryItem[]>([])
  const [extensions, setExtensions] = useState<ExtensionRegistryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SkillDetailState | null>(null)
  const [reloading, setReloading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [skillsData, extensionsData] = await Promise.all([
        window.electronAPI.skillsList(),
        window.electronAPI.extensionsList(),
      ])
      setSkills(skillsData)
      setExtensions(extensionsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load registry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleReload = async () => {
    setReloading(true)
    try {
      await window.electronAPI.registryReload()
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reload failed')
    } finally {
      setReloading(false)
    }
  }

  const handleToggleSkill = async (item: SkillRegistryItem) => {
    setTogglingId(item.id)
    try {
      const res = await window.electronAPI.skillsToggle({
        skillKey: item.id,
        enabled: !item.enabled,
      })
      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, enabled: !s.enabled } : s))
        )
        showFeedback(item.id, `${item.name} ${!item.enabled ? 'enabled' : 'disabled'}`, 'success')
      }
    } catch (e) {
      showFeedback(item.id, e instanceof Error ? e.message : 'Toggle failed', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleExtension = async (item: ExtensionRegistryItem) => {
    setTogglingId(item.id)
    try {
      const res = await window.electronAPI.extensionsToggle({
        pluginId: item.id,
        enabled: !item.enabled,
      })
      if (res.ok) {
        setExtensions((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, enabled: !e.enabled } : e))
        )
        showFeedback(item.id, `${item.name} ${!item.enabled ? 'enabled' : 'disabled'}`, 'success')
      }
    } catch (e) {
      showFeedback(item.id, e instanceof Error ? e.message : 'Toggle failed', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleValidate = async (kind: 'skill' | 'extension', id: string) => {
    if (!detail) return
    setDetail((prev) => prev ? { ...prev, validating: true } : null)
    try {
      const result = await window.electronAPI.registryValidate({ kind, id })
      setDetail((prev) => prev ? { ...prev, validation: result, validating: false } : null)
    } catch (e) {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              validation: { ok: false, errors: [e instanceof Error ? e.message : 'Validation failed'] },
              validating: false,
            }
          : null
      )
    }
  }

  const showFeedback = (id: string, message: string, type: 'success' | 'error') => {
    setActionFeedback({ id, message, type })
    setTimeout(() => setActionFeedback(null), 3000)
  }

  const openDetail = (kind: 'skill' | 'extension', item: SkillRegistryItem | ExtensionRegistryItem) => {
    setDetail({ kind, item, validation: null, validating: false })
  }

  const filteredSkills = useMemo(() => {
    let items = skills
    if (sourceFilter !== 'all') {
      items = items.filter((s) =>
        sourceFilter === 'bundled' ? s.source === 'bundled' : s.source !== 'bundled'
      )
    }
    if (statusFilter === 'enabled') items = items.filter((s) => s.enabled)
    if (statusFilter === 'disabled') items = items.filter((s) => !s.enabled)
    if (statusFilter === 'error') items = items.filter((s) => s.conflict)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false)
      )
    }
    return items
  }, [skills, sourceFilter, statusFilter, searchQuery])

  const filteredExtensions = useMemo(() => {
    let items = extensions
    if (sourceFilter !== 'all') {
      items = items.filter((e) =>
        sourceFilter === 'bundled' ? e.source === 'bundled' : e.source !== 'bundled'
      )
    }
    if (statusFilter === 'enabled') items = items.filter((e) => e.enabled)
    if (statusFilter === 'disabled') items = items.filter((e) => !e.enabled)
    if (statusFilter === 'error') items = items.filter((e) => e.error)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.description?.toLowerCase().includes(q) ?? false)
      )
    }
    return items
  }, [extensions, sourceFilter, statusFilter, searchQuery])

  const defaultBack = () => {
    window.location.hash = ''
  }
  const onBackFn = onBack ?? defaultBack

  if (loading && skills.length === 0) {
    return (
      <ShellLayout title="Skills & Extensions" onBack={onBackFn}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading registry…
        </div>
      </ShellLayout>
    )
  }

  if (detail) {
    const { kind, item, validation, validating } = detail
    const ext = isExtension(item) ? item : null
    return (
      <ShellLayout title={item.name} onBack={() => setDetail(null)}>
        <div className="flex flex-col gap-6 max-w-2xl">
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{item.id}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSourceBadge(item.source)}`}>
                {item.source}
              </span>
            </div>
            {item.description && (
              <p className="text-sm text-foreground/80 mb-4">{item.description}</p>
            )}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="flex items-center gap-1.5 mt-0.5">
                  {item.enabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-hidden />
                      <span className="text-green-600 dark:text-green-400">Enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">Disabled</span>
                    </>
                  )}
                </dd>
              </div>
              {item.version && (
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="mt-0.5">{item.version}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-muted-foreground">Path</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{item.path}</dd>
              </div>
              {!isExtension(item) && item.requires && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Requirements</dt>
                  <dd className="mt-0.5 text-xs">
                    {item.requires.bins && <span>Bins: {item.requires.bins.join(', ')}</span>}
                    {item.requires.env && <span className="ml-3">Env: {item.requires.env.join(', ')}</span>}
                  </dd>
                </div>
              )}
              {!isExtension(item) && item.conflict && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden />
                    Conflict
                  </dt>
                  <dd className="mt-0.5 text-amber-600 dark:text-amber-400 text-xs">{item.conflict}</dd>
                </div>
              )}
              {ext?.providers && ext.providers.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Providers</dt>
                  <dd className="mt-0.5 text-xs">{ext.providers.join(', ')}</dd>
                </div>
              )}
              {ext?.tools && ext.tools.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Tools</dt>
                  <dd className="mt-0.5 text-xs">{ext.tools.join(', ')}</dd>
                </div>
              )}
              {ext?.commands && ext.commands.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Commands</dt>
                  <dd className="mt-0.5 text-xs">{ext.commands.join(', ')}</dd>
                </div>
              )}
              {ext?.error && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-destructive" aria-hidden />
                    Error
                  </dt>
                  <dd className="mt-0.5 text-destructive text-xs">{ext.error}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleValidate(kind, item.id)} disabled={validating}>
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />
              ) : (
                <FileText className="w-4 h-4 mr-1" aria-hidden />
              )}
              Validate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.electronAPI.systemOpenPath(item.path)}
            >
              <FolderOpen className="w-4 h-4 mr-1" aria-hidden />
              Open folder
            </Button>
          </div>

          {validation && (
            <section
              className={`rounded-lg border p-4 ${
                validation.ok
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                  : 'border-destructive/50 bg-destructive/5'
              }`}
              aria-label="Validation result"
            >
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                {validation.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden />
                    Validation passed
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" aria-hidden />
                    Validation failed
                  </>
                )}
              </h3>
              {validation.errors && validation.errors.length > 0 && (
                <ul className="text-sm text-destructive space-y-1">
                  {validation.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
              {validation.warnings && validation.warnings.length > 0 && (
                <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1 mt-2">
                  {validation.warnings.map((warn, i) => (
                    <li key={i}>⚠ {warn}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </ShellLayout>
    )
  }

  const currentItems = tab === 'skills' ? filteredSkills : filteredExtensions
  const totalItems = tab === 'skills' ? skills : extensions

  return (
    <ShellLayout title="Skills & Extensions" onBack={onBackFn}>
      <div className="flex flex-col gap-4 max-w-3xl">
        {error && (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {actionFeedback && (
          <div
            className={`rounded-lg border p-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
              actionFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400'
                : 'border-destructive/50 bg-destructive/5 text-destructive'
            }`}
            role="status"
          >
            {actionFeedback.message}
          </div>
        )}

        {/* Tab bar + actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-muted rounded-lg p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'skills'}
              onClick={() => setTab('skills')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'skills'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Puzzle className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" aria-hidden />
              Skills ({skills.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'extensions'}
              onClick={() => setTab('extensions')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'extensions'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" aria-hidden />
              Extensions ({extensions.length})
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={reloading}
          >
            {reloading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden />
            )}
            <span className="ml-1.5">Reload</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              placeholder={`Search ${tab}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label={`Search ${tab}`}
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
            <SelectTrigger className="w-36" aria-label="Filter by source">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="bundled">Bundled</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <section aria-label={`${tab} list`}>
          {currentItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center">
              <Puzzle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" aria-hidden />
              <p className="text-sm font-medium text-muted-foreground">
                {totalItems.length === 0
                  ? `No ${tab} found`
                  : `No ${tab} match the current filters`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalItems.length === 0
                  ? `${tab === 'skills' ? 'Skills' : 'Extensions'} will appear here once detected in the OpenClaw installation.`
                  : 'Try adjusting search or filter criteria.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {currentItems.map((item) => {
                const isToggling = togglingId === item.id
                const ext = isExtension(item) ? item : null
                const skill = !isExtension(item) ? item : null
                const hasError = ext?.error || skill?.conflict
                return (
                  <li
                    key={item.id}
                    className="group rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        onClick={() =>
                          tab === 'skills'
                            ? handleToggleSkill(item as SkillRegistryItem)
                            : handleToggleExtension(item as ExtensionRegistryItem)
                        }
                        disabled={isToggling}
                        aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden />
                        ) : item.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-500" aria-hidden />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" aria-hidden />
                        )}
                      </button>

                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        onClick={() => openDetail(tab === 'skills' ? 'skill' : 'extension', item)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          {item.version && (
                            <span className="text-xs text-muted-foreground shrink-0">v{item.version}</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceBadge(item.source)}`}>
                            {item.source}
                          </span>
                          {hasError && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden />
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                        )}
                      </button>

                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        aria-hidden
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Summary */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Showing {currentItems.length} of {totalItems.length} {tab}
          {' · '}
          {totalItems.filter((i) => i.enabled).length} enabled
        </p>
      </div>
    </ShellLayout>
  )
}
