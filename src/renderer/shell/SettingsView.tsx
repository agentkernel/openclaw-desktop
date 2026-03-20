import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ShellLayout } from './ShellLayout'
import type { ShellConfig, ShellTheme } from '../../shared/types'

export interface SettingsViewProps {
  /** Back navigation when embedded in parent layout */
  onBack?: () => void
}

function defaultNavigateBack() {
  window.location.hash = ''
}

const THEME_OPTIONS: { value: ShellTheme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    ),
  },
]

function applyTheme(theme: ShellTheme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  id: string
}

function Toggle({ checked, onChange, id }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function SettingsView({ onBack }: SettingsViewProps = {}) {
  const handleBack = onBack ?? defaultNavigateBack
  const [config, setConfig] = useState<ShellConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.shellGetConfig().then((cfg) => {
      setConfig(cfg)
      setLoading(false)
      applyTheme(cfg.theme)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (config?.theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [config?.theme])

  const updateConfig = useCallback(
    (patch: Partial<ShellConfig>) => {
      if (!config) return
      const updated = { ...config, ...patch }
      setConfig(updated)
      void window.electronAPI.shellSetConfig(patch)

      if (patch.theme !== undefined) {
        applyTheme(patch.theme)
      }
    },
    [config],
  )

  if (loading) {
    return (
      <ShellLayout title="Settings" onBack={handleBack}>
        <div className="flex items-center justify-center min-h-[40vh]" role="status">
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        </div>
      </ShellLayout>
    )
  }

  if (!config) {
    return (
      <ShellLayout title="Settings" onBack={handleBack}>
        <div className="flex items-center justify-center min-h-[40vh]" role="alert">
          <p className="text-sm text-destructive">Failed to load settings</p>
        </div>
      </ShellLayout>
    )
  }

  return (
    <ShellLayout title="Settings" onBack={handleBack}>
      <div className="w-full max-w-md flex flex-col gap-8">
        <section className="flex flex-col gap-6" aria-label="General settings">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="close-to-tray" className="text-sm font-medium">
                Minimize to tray when closing
              </label>
              <p className="text-xs text-muted-foreground">
                App continues running in system tray after closing window
              </p>
            </div>
            <Toggle
              id="close-to-tray"
              checked={config.closeToTray}
              onChange={(v) => updateConfig({ closeToTray: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="auto-start" className="text-sm font-medium">
                Start at login
              </label>
              <p className="text-xs text-muted-foreground">
                Launch OpenClaw when you sign in to Windows
              </p>
            </div>
            <Toggle
              id="auto-start"
              checked={config.autoStart}
              onChange={(v) => updateConfig({ autoStart: v })}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Appearance theme</span>
              <p className="text-xs text-muted-foreground">
                Choose the display theme for the app
              </p>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme selection">
              {THEME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={config.theme === opt.value ? 'default' : 'outline'}
                  size="sm"
                  role="radio"
                  aria-checked={config.theme === opt.value}
                  onClick={() => updateConfig({ theme: opt.value })}
                  className="flex-1"
                >
                  {opt.icon}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Update channel</span>
              <p className="text-xs text-muted-foreground">
                Choose between stable releases or beta for early access
              </p>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Update channel">
              <Button
                variant={config.updateChannel === 'stable' ? 'default' : 'outline'}
                size="sm"
                role="radio"
                aria-checked={config.updateChannel === 'stable'}
                onClick={() => updateConfig({ updateChannel: 'stable' })}
              >
                Stable
              </Button>
              <Button
                variant={config.updateChannel === 'beta' ? 'default' : 'outline'}
                size="sm"
                role="radio"
                aria-checked={config.updateChannel === 'beta'}
                onClick={() => updateConfig({ updateChannel: 'beta' })}
              >
                Beta
              </Button>
            </div>
          </div>
        </section>
      </div>
    </ShellLayout>
  )
}
