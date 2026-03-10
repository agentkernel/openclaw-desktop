import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ShellLayout } from './ShellLayout'
import type { AppVersionInfo } from '../../shared/types'
import { formatMainVersion } from '@/utils/version-format'

const PROJECT_URL = 'https://github.com/agentkernel/openclaw-desktop'

export interface AboutViewProps {
  /** 嵌入模式时由父组件提供的返回回调 */
  onBack?: () => void
}

function defaultNavigateBack() {
  window.location.hash = ''
}

function ExternalLinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

const VERSION_LABELS: { key: keyof AppVersionInfo; label: string }[] = [
  { key: 'shell', label: 'Shell version' },
  { key: 'electron', label: 'Electron' },
  { key: 'node', label: 'Node.js' },
  { key: 'openclaw', label: 'OpenClaw' },
]


export function AboutView({ onBack }: AboutViewProps = {}) {
  const handleBack = onBack ?? defaultNavigateBack
  const [versions, setVersions] = useState<AppVersionInfo | null>(null)

  useEffect(() => {
    window.electronAPI.shellGetVersions().then(setVersions).catch(() => {
      // noop — version display will show loading state
    })
  }, [])

  const handleOpenProject = () => {
    void window.electronAPI.systemOpenExternal(PROJECT_URL)
  }

  return (
    <ShellLayout title="About" onBack={handleBack}>
      <div className="flex flex-col items-center justify-center gap-8 min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-2xl font-bold text-primary-foreground tracking-tight">OC</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">OpenClaw Desktop</h2>
        </div>

        {versions ? (
          <>
            <p className="text-base font-medium font-mono" aria-label="Main version">
              {formatMainVersion(versions)}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {VERSION_LABELS.map(({ key, label }) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground text-right">{label}</dt>
                <dd className="font-mono">{versions[key]}</dd>
              </div>
            ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Fetching version info…
          </p>
        )}

        <Button variant="outline" size="sm" onClick={handleOpenProject}>
          <ExternalLinkIcon />
          View project on GitHub
        </Button>
      </div>
    </ShellLayout>
  )
}
