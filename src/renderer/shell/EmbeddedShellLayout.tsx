import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Settings,
  Info,
  Key,
  Puzzle,
  RefreshCw,
  LayoutDashboard,
  ChevronLeft,
} from 'lucide-react'
import { LoadingView } from './LoadingView'
import { ErrorView, type ErrorType } from './ErrorView'
import { SettingsView } from './SettingsView'
import { AboutView } from './AboutView'
import { DashboardView } from './DashboardView'
import { ProviderView } from './ProviderView'
import { SkillsView } from './SkillsView'
import { UpdateView } from './UpdateView'
import { FeishuAccessView } from './FeishuAccessView'
import type { GatewayStatus, GatewayStatusValue } from '../../shared/types'
import { useUpdateNoticeStore } from '@/stores/update-store'

const TIMEOUT_MS = 300_000

const STATUS_LABELS: Record<GatewayStatusValue, string> = {
  starting: 'Gateway is starting…',
  running: 'Gateway is ready',
  stopped: 'Waiting for Gateway to start…',
  error: 'Gateway failed to start',
}

interface ErrorInfo {
  errorType: ErrorType
  title: string
  detail?: string
}

export type EmbeddedPanel =
  | ''
  | 'settings'
  | 'about'
  | 'dashboard'
  | 'llm-api'
  | 'skills'
  | 'updates'
  | 'feishu-settings'

export interface EmbeddedShellLayoutProps {
  activePanel: EmbeddedPanel
  onPanelChange: (panel: EmbeddedPanel) => void
}

function buildControlUIUrl(port: number, token?: string): string {
  let url = `http://127.0.0.1:${port}/`
  if (token && typeof token === 'string' && token.trim()) {
    url = `${url}#token=${encodeURIComponent(token.trim())}`
  }
  return url
}

const DESKTOP_NAV_ITEMS: { id: EmbeddedPanel; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Gateway status & versions' },
  { id: 'llm-api', label: 'LLM API', icon: <Key className="w-4 h-4" />, description: 'Providers & auth profiles' },
  { id: 'skills', label: 'Skills', icon: <Puzzle className="w-4 h-4" />, description: 'Skills & extensions' },
  { id: 'updates', label: 'Updates', icon: <RefreshCw className="w-4 h-4" />, description: 'Check for updates' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, description: 'Appearance & startup' },
  { id: 'about', label: 'About', icon: <Info className="w-4 h-4" />, description: 'Version info' },
]

export function EmbeddedShellLayout({ activePanel, onPanelChange }: EmbeddedShellLayoutProps) {
  const { t } = useTranslation()
  const [gatewayView, setGatewayView] = useState<'loading' | 'error'>('loading')
  const [statusText, setStatusText] = useState('Gateway is starting…')
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [gatewayPort, setGatewayPort] = useState<number | null>(null)
  const [controlUrl, setControlUrl] = useState<string | null>(null)
  /** Bumps when the gateway process restarts so the iframe remounts and opens a fresh WebSocket (same #token URL would otherwise not reload). */
  const [controlUiReloadKey, setControlUiReloadKey] = useState(0)
  const prevGatewayStatusRef = useRef<GatewayStatusValue | null>(null)
  const lastRunningPidRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateAvailable = useUpdateNoticeStore((state) => state.available)
  const updateDismissed = useUpdateNoticeStore((state) => state.dismissed)
  const updateInfo = useUpdateNoticeStore((state) => state.info)
  const setUpdateAvailable = useUpdateNoticeStore((state) => state.setUpdateAvailable)
  const dismissUpdateNotice = useUpdateNoticeStore((state) => state.dismissUpdateNotice)

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const showError = useCallback((info: ErrorInfo) => {
    clearTimeoutTimer()
    setTimedOut(false)
    setGatewayView('error')
    setErrorInfo(info)
  }, [clearTimeoutTimer])

  const startTimeoutTimer = useCallback(() => {
    clearTimeoutTimer()
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true)
      setStatusText('Gateway did not become ready within 5 minutes. Please check logs or retry.')
    }, TIMEOUT_MS)
  }, [clearTimeoutTimer])

  const handleStatusUpdate = useCallback(
    (status: GatewayStatus) => {
      const prev = prevGatewayStatusRef.current
      prevGatewayStatusRef.current = status.status

      setStatusText(STATUS_LABELS[status.status])
      if (status.status === 'running') {
        clearTimeoutTimer()
        setGatewayView('loading')

        const resumedFromNonRunning = prev !== 'running'
        const pidChanged =
          status.pid != null &&
          lastRunningPidRef.current != null &&
          status.pid !== lastRunningPidRef.current
        const shouldReloadControlUi = resumedFromNonRunning || pidChanged
        if (status.pid != null) {
          lastRunningPidRef.current = status.pid
        }

        setGatewayPort(status.port)
        void (async () => {
          try {
            const config = await window.electronAPI.configRead()
            const token = config?.gateway?.auth?.token
            const url = buildControlUIUrl(status.port, token)
            if (shouldReloadControlUi) {
              setControlUiReloadKey((k) => k + 1)
            }
            setControlUrl(url)
          } catch {
            if (shouldReloadControlUi) {
              setControlUiReloadKey((k) => k + 1)
            }
            setControlUrl(buildControlUIUrl(status.port))
          }
        })()
      } else {
        if (prev === 'running') {
          setGatewayPort(null)
          setControlUrl(null)
        }
        if (status.status === 'error') {
          showError({
            errorType: 'gateway-crash',
            title: 'Gateway service exited unexpectedly',
            detail: 'Please check Gateway configuration and logs, then retry.',
          })
        }
      }
    },
    [showError, clearTimeoutTimer],
  )

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const status = await window.electronAPI.gatewayStatus()
        if (!mounted) return
        handleStatusUpdate(status)
        if (status.status === 'stopped') {
          startTimeoutTimer()
          try {
            await window.electronAPI.gatewayStart()
          } catch {
            if (!mounted) return
            showError({
              errorType: 'start-failure',
              title: 'Gateway failed to start',
              detail: 'Unable to start Gateway process. Please check installation integrity.',
            })
          }
        } else if (status.status === 'starting') {
          startTimeoutTimer()
        }
      } catch {
        if (!mounted) return
        showError({
          errorType: 'connection-error',
          title: 'Unable to connect to main process',
          detail: 'Internal communication failed. Please restart the application.',
        })
      }
    }
    void init()
    const unsub = window.electronAPI.onGatewayStatusChange((status) => {
      if (mounted) handleStatusUpdate(status)
    })
    return () => {
      mounted = false
      unsub()
      clearTimeoutTimer()
    }
  }, [handleStatusUpdate, startTimeoutTimer, clearTimeoutTimer, showError])

  useEffect(() => {
    const unsub = window.electronAPI.onUpdateAvailable((info) => {
      const payload = info as { version?: string; releaseNotes?: string; releaseDate?: string }
      const version = payload?.version?.toString().trim()
      if (!version) return
      setUpdateAvailable({
        version,
        releaseNotes: payload.releaseNotes,
        publishedAt: payload.releaseDate,
      })
    })
    return () => {
      unsub()
    }
  }, [setUpdateAvailable])

  useEffect(() => {
    if (activePanel === 'updates') {
      dismissUpdateNotice()
    }
  }, [activePanel, dismissUpdateNotice])

  const handleRetry = async () => {
    setGatewayView('loading')
    setErrorInfo(null)
    setTimedOut(false)
    setStatusText('Restarting Gateway…')
    startTimeoutTimer()
    try {
      await window.electronAPI.gatewayRestart()
    } catch {
      showError({
        errorType: 'start-failure',
        title: 'Gateway restart failed',
        detail: 'Please check Gateway configuration and logs, then retry.',
      })
    }
  }

  const handleOpenLogDir = () => {
    void window.electronAPI.systemOpenLogDir()
  }

  const handleNavigateToPanel = (panel: EmbeddedPanel) => {
    onPanelChange(panel)
  }

  const showControlUIIframe = gatewayPort !== null && controlUrl !== null
  const hasActivePanel = activePanel !== ''

  if (gatewayView === 'error' && errorInfo) {
    return (
      <ErrorView
        errorType={errorInfo.errorType}
        title={errorInfo.title}
        detail={errorInfo.detail}
        onRetry={handleRetry}
        onOpenLogDir={handleOpenLogDir}
      />
    )
  }

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'settings':
        return (
          <SettingsView
            onBack={() => onPanelChange('')}
            onOpenFeishuSettings={() => onPanelChange('feishu-settings')}
          />
        )
      case 'about':
        return <AboutView onBack={() => onPanelChange('')} />
      case 'dashboard':
        return (
          <DashboardView
            onNavigateToSettings={() => handleNavigateToPanel('settings')}
            onNavigateToLlmApi={() => handleNavigateToPanel('llm-api')}
            onNavigateToSkills={() => handleNavigateToPanel('skills')}
            onNavigateToUpdates={() => handleNavigateToPanel('updates')}
            onNavigateToFeishuSettings={() => handleNavigateToPanel('feishu-settings')}
            updateAvailable={updateAvailable && !updateDismissed}
            updateVersion={updateInfo?.version}
            onDismissUpdateNotice={() => dismissUpdateNotice()}
          />
        )
      case 'llm-api':
        return <ProviderView onBack={() => onPanelChange('')} />
      case 'skills':
        return <SkillsView onBack={() => onPanelChange('')} />
      case 'updates':
        return (
          <UpdateView
            onBack={() => onPanelChange('')}
            updateAvailable={updateAvailable}
            updateVersion={updateInfo?.version}
            updateNotes={updateInfo?.releaseNotes}
            onDismissUpdateNotice={() => dismissUpdateNotice()}
          />
        )
      case 'feishu-settings':
        return <FeishuAccessView onBack={() => onPanelChange('settings')} />
      default:
        return null
    }
  }

  return (
    <main className="h-screen relative overflow-hidden select-none" role="main">
      {/* Full-screen Control UI iframe (always mounted when available).
          Do not use flex-1 on iframe: in column flex layouts the iframe often collapses to 0 height
          (only the dark shell body shows through — looks like a black window). */}
      {showControlUIIframe ? (
        <iframe
          key={`openclaw-control-ui-${controlUiReloadKey}`}
          src={controlUrl}
          title="OpenClaw Control UI"
          className={`absolute inset-0 z-0 h-full w-full border-0 bg-background ${
            hasActivePanel ? 'opacity-0 pointer-events-none' : ''
          }`}
          referrerPolicy="no-referrer"
          allowFullScreen
        />
      ) : (
        !hasActivePanel && (
          <div className="absolute inset-0 z-0 flex min-h-0 items-center justify-center overflow-auto p-4">
            <LoadingView
              variant="embedded"
              statusText={statusText}
              timedOut={timedOut}
              onRetry={handleRetry}
              hintText="Startup takes approximately 5 minutes, please wait."
            />
          </div>
        )
      )}

      {/* Desktop panel overlay: flex column + scroll region so flex-1 panels are not height-collapsed */}
      {hasActivePanel && (
        <div className="absolute inset-0 z-30 flex min-h-0 flex-col bg-background">
          <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPanelChange('')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-muted"
              aria-label="Back to Control UI"
            >
              <ChevronLeft className="w-4 h-4" />
              Control UI
            </button>
            <span className="text-sm text-border">/</span>
            <span className="text-sm font-medium">
              {activePanel === 'feishu-settings'
                ? t('shell.feishu.title')
                : DESKTOP_NAV_ITEMS.find((item) => item.id === activePanel)?.label ?? activePanel}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{renderPanelContent()}</div>
        </div>
      )}

    </main>
  )
}
