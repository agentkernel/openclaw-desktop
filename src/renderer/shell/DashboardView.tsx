import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  FileText,
  Settings,
  RefreshCw,
  ChevronRight,
  Wrench,
  Package,
  Key,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GatewayStatus, GatewayStatusValue, AppVersionInfo } from '../../shared/types'
import { formatMainVersion } from '@/utils/version-format'

const VERSION_LABELS: { key: keyof AppVersionInfo; label: string }[] = [
  { key: 'shell', label: 'Shell' },
  { key: 'electron', label: 'Electron' },
  { key: 'node', label: 'Node.js' },
  { key: 'openclaw', label: 'OpenClaw' },
]

const STATUS_LABELS: Record<GatewayStatusValue, string> = {
  starting: 'Starting…',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
}

const STATUS_COLORS: Record<GatewayStatusValue, string> = {
  starting: 'text-amber-600 dark:text-amber-400',
  running: 'text-green-600 dark:text-green-400',
  stopped: 'text-muted-foreground',
  error: 'text-destructive',
}

export interface DashboardViewProps {
  /** Navigate to Settings panel when user clicks Settings action card */
  onNavigateToSettings: () => void
  /** Navigate to LLM API management panel when user clicks LLM API action card */
  onNavigateToLlmApi?: () => void
  /** Navigate to Skills management panel */
  onNavigateToSkills?: () => void
  /** Navigate to Updates panel */
  onNavigateToUpdates?: () => void
  /** Whether an update is available */
  updateAvailable?: boolean
  /** Latest version string */
  updateVersion?: string
  /** Dismiss update banner */
  onDismissUpdateNotice?: () => void
}

interface ActionCardProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  highlight?: boolean
}

function ActionCard({ title, description, icon, onClick, disabled, highlight }: ActionCardProps) {
  const content = (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
      }
      aria-label={disabled ? `${title} (Coming soon)` : title}
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0" aria-hidden>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {highlight && <span className="w-2 h-2 rounded-full bg-sky-500" aria-label="Update available" />}
        </div>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {!disabled && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />}
    </div>
  )
  return content
}

export function DashboardView({
  onNavigateToSettings,
  onNavigateToLlmApi,
  onNavigateToSkills,
  onNavigateToUpdates,
  updateAvailable,
  updateVersion,
  onDismissUpdateNotice,
}: DashboardViewProps) {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null)
  const [versions, setVersions] = useState<AppVersionInfo | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)

  const handleStatusUpdate = useCallback((status: GatewayStatus) => {
    setGatewayStatus(status)
    if (status.status === 'error') {
      setLastError('Gateway service exited unexpectedly. Check logs or retry.')
    } else {
      setLastError(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const status = await window.electronAPI.gatewayStatus()
        if (mounted) handleStatusUpdate(status)
      } catch {
        if (mounted) setGatewayStatus(null)
      }
    }
    void init()
    const unsub = window.electronAPI.onGatewayStatusChange((status) => {
      if (mounted) handleStatusUpdate(status)
    })
    return () => {
      mounted = false
      unsub()
    }
  }, [handleStatusUpdate])

  useEffect(() => {
    window.electronAPI.shellGetVersions().then(setVersions).catch(() => {})
  }, [])

  const handleStartGateway = async () => {
    setRestarting(true)
    try {
      await window.electronAPI.gatewayStart()
    } finally {
      setRestarting(false)
    }
  }

  const handleRestartGateway = async () => {
    setRestarting(true)
    try {
      await window.electronAPI.gatewayRestart()
    } finally {
      setRestarting(false)
    }
  }

  const handleOpenLogDir = () => {
    void window.electronAPI.systemOpenLogDir()
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-6 animate-in fade-in duration-200"
      role="main"
      aria-label="Dashboard - Gateway status and quick actions"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gateway status, version info, and quick access to settings and logs
          </p>
        </header>

        {updateAvailable && updateVersion && (
          <section
            className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3"
            aria-live="polite"
            role="status"
          >
            <RefreshCw className="w-4 h-4 text-primary mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">New update available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Version <span className="font-mono">Shell v{updateVersion}</span> is ready to install.
              </p>
            </div>
            <div className="flex gap-2">
              {onNavigateToUpdates && (
                <Button size="sm" onClick={onNavigateToUpdates}>
                  View updates
                </Button>
              )}
              {onDismissUpdateNotice && (
                <Button size="sm" variant="ghost" onClick={onDismissUpdateNotice}>
                  Dismiss
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Gateway status card */}
        <section
          className="rounded-lg border border-border bg-card p-4"
          aria-label="Gateway status"
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">Gateway</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-sm font-medium ${gatewayStatus ? STATUS_COLORS[gatewayStatus.status] : 'text-muted-foreground'}`}
            >
              {gatewayStatus ? STATUS_LABELS[gatewayStatus.status] : 'Loading…'}
            </span>
            {gatewayStatus?.status === 'running' && gatewayStatus.port > 0 && (
              <span className="text-xs text-muted-foreground font-mono">Port {gatewayStatus.port}</span>
            )}
            {(gatewayStatus?.status === 'stopped' || gatewayStatus?.status === 'error') && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={gatewayStatus.status === 'error' ? 'destructive' : 'default'}
                  onClick={gatewayStatus.status === 'error' ? handleRestartGateway : handleStartGateway}
                  disabled={restarting}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} aria-hidden />
                  {gatewayStatus.status === 'error' ? 'Restart' : 'Start'}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Recent errors (when applicable) */}
        {lastError && (
          <section
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4"
            aria-live="polite"
            role="alert"
          >
            <h2 className="text-sm font-medium text-destructive mb-1">Recent error</h2>
            <p className="text-sm text-muted-foreground">{lastError}</p>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={handleOpenLogDir}>
                <FileText className="w-3.5 h-3.5" aria-hidden />
                Open log directory
              </Button>
            </div>
          </section>
        )}

        {/* Version info card */}
        <section
          className="rounded-lg border border-border bg-card p-4"
          aria-label="Version information"
        >
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">Versions</h2>
          </div>
          {versions ? (
            <>
              <p className="text-sm font-medium font-mono mb-2" aria-label="Main version">
                {formatMainVersion(versions)}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {VERSION_LABELS.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono">{versions[key]}</dd>
                </div>
              ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              Loading version info…
            </p>
          )}
        </section>

        {/* Quick actions */}
        <section aria-label="Quick actions">
          <h2 className="text-sm font-medium mb-3">Quick actions</h2>
          <div className="grid gap-2">
            <ActionCard
              title="Logs"
              description="Open log directory"
              icon={<FileText className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={handleOpenLogDir}
            />
            <ActionCard
              title="Diagnostics"
              description="Export diagnostic report"
              icon={<Download className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={() => {
                void window.electronAPI.diagnosticsExport().catch(() => {})
              }}
            />
            <ActionCard
              title="Settings"
              description="Appearance, startup, theme"
              icon={<Settings className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={onNavigateToSettings}
            />
            <ActionCard
              title="Updates"
              description="Check for new versions"
              icon={<RefreshCw className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={onNavigateToUpdates}
              disabled={!onNavigateToUpdates}
              highlight={Boolean(updateAvailable)}
            />
            <ActionCard
              title="Skills"
              description="Manage skills and extensions"
              icon={<Wrench className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={onNavigateToSkills}
              disabled={!onNavigateToSkills}
            />
            <ActionCard
              title="LLM API"
              description="Providers and auth profiles"
              icon={<Key className="w-5 h-5 text-muted-foreground" aria-hidden />}
              onClick={onNavigateToLlmApi}
              disabled={!onNavigateToLlmApi}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
