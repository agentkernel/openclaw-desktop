import { useState, useEffect, useCallback, useRef } from 'react'
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

export type EmbeddedPanel = '' | 'settings' | 'about' | 'dashboard' | 'llm-api' | 'skills' | 'updates'

export interface EmbeddedShellLayoutProps {
  activePanel: EmbeddedPanel
  onPanelChange: (panel: EmbeddedPanel) => void
}

function buildControlUIUrl(port: number, token?: string): string {
  let url = `http://127.0.0.1:${port}/`
  if (token && typeof token === 'string' && token.trim()) {
    url = `${url}?token=${encodeURIComponent(token.trim())}`
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
  const [gatewayView, setGatewayView] = useState<'loading' | 'error'>('loading')
  const [statusText, setStatusText] = useState('Gateway is starting…')
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [gatewayPort, setGatewayPort] = useState<number | null>(null)
  const [controlUrl, setControlUrl] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasResizedForMainRef = useRef(false)
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
      setStatusText(STATUS_LABELS[status.status])
      if (status.status === 'running') {
        clearTimeoutTimer()
        setGatewayPort(status.port)
        setGatewayView('loading')
        void (async () => {
          try {
            const config = await window.electronAPI.configRead()
            const token = config?.gateway?.auth?.token
            setControlUrl(buildControlUIUrl(status.port, token))
          } catch {
            setControlUrl(buildControlUIUrl(status.port))
          }
        })()
      } else if (status.status === 'error') {
        showError({
          errorType: 'gateway-crash',
          title: 'Gateway service exited unexpectedly',
          detail: 'Please check Gateway configuration and logs, then retry.',
        })
      }
    },
    [clearTimeoutTimer, showError],
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

  // 首次进入主界面（Control UI）时调整窗口大小，与向导窗口区分
  useEffect(() => {
    if (showControlUIIframe && !hasActivePanel && !hasResizedForMainRef.current) {
      hasResizedForMainRef.current = true
      void window.electronAPI.shellResizeForMainInterface()
    }
  }, [showControlUIIframe, hasActivePanel])

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
        return <SettingsView onBack={() => onPanelChange('')} />
      case 'about':
        return <AboutView onBack={() => onPanelChange('')} />
      case 'dashboard':
        return (
          <DashboardView
            onNavigateToSettings={() => handleNavigateToPanel('settings')}
            onNavigateToLlmApi={() => handleNavigateToPanel('llm-api')}
            onNavigateToSkills={() => handleNavigateToPanel('skills')}
            onNavigateToUpdates={() => handleNavigateToPanel('updates')}
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
      default:
        return null
    }
  }

  return (
    <main className="h-screen flex flex-col select-none relative overflow-hidden" role="main">
      {/* Full-screen Control UI iframe (always mounted when available) */}
      {showControlUIIframe ? (
        <iframe
          src={controlUrl}
          title="OpenClaw Control UI"
          className={`flex-1 w-full min-h-0 border-0 ${hasActivePanel ? 'invisible' : ''}`}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          referrerPolicy="no-referrer"
        />
      ) : (
        !hasActivePanel && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingView
              statusText={statusText}
              timedOut={timedOut}
              onRetry={handleRetry}
              hintText="Startup takes approximately 5 minutes, please wait."
            />
          </div>
        )
      )}

      {/* Desktop panel overlay */}
      {hasActivePanel && (
        <div className="absolute inset-0 z-30 bg-background overflow-y-auto animate-in fade-in duration-200">
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-2 flex items-center gap-2">
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
              {DESKTOP_NAV_ITEMS.find(item => item.id === activePanel)?.label ?? activePanel}
            </span>
          </div>
          <div className="flex-1">
            {renderPanelContent()}
          </div>
        </div>
      )}

    </main>
  )
}
