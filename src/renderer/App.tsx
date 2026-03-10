import { useState, useEffect, useCallback } from 'react'
import { LoadingView } from '@/shell/LoadingView'
import { EmbeddedShellLayout, type EmbeddedPanel } from '@/shell/EmbeddedShellLayout'
import { WizardLayout } from './wizard/WizardLayout'

function getHashRoute(): string {
  return window.location.hash.replace(/^#/, '')
}

function App() {
  const [route, setRoute] = useState<string | null>(null)
  const [configExists, setConfigExists] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window.electronAPI === 'undefined') return
    window.electronAPI
      .configExists()
      .then((exists) => {
        setConfigExists(exists)
        if (!exists) {
          setRoute('wizard')
          return
        }
        setRoute(getHashRoute() || '')
      })
      .catch((err) => {
        console.warn('[OpenClaw] configExists failed:', err)
        setConfigExists(false)
        setRoute('wizard')
      })
  }, [])

  useEffect(() => {
    if (configExists !== true) return
    const handler = () => setRoute(getHashRoute() || '')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [configExists])

  const handlePanelChange = useCallback((panel: EmbeddedPanel) => {
    const hash = panel === '' ? '' : `#${panel}`
    if (window.location.hash !== hash) {
      window.location.hash = hash
    }
    setRoute(panel)
  }, [])

  if (typeof window.electronAPI === 'undefined') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">OpenClaw Desktop</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Preload script failed to load, internal communication is unavailable. Please try reinstalling or repackaging the app.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          If debugging, check that `index.cjs` exists in `resources/app.asar(.unpacked)/out/preload/`.
        </p>
      </main>
    )
  }

  if (route === null || configExists === null) return <LoadingView statusText="Checking configuration…" />
  if (route === 'wizard') return <WizardLayout />
  if (configExists) {
    const panel: EmbeddedPanel = (route === 'settings' || route === 'about' || route === 'dashboard' || route === 'llm-api' || route === 'skills' || route === 'updates') ? route : ''
    return (
      <EmbeddedShellLayout
        activePanel={panel}
        onPanelChange={handlePanelChange}
      />
    )
  }
  return <LoadingView statusText="Checking configuration…" />
}

export default App
