import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initI18n } from './i18n'
import './styles/globals.css'

// Debug: if this prints, the shell renderer loaded
console.info('[OpenClaw] Renderer started', typeof window.electronAPI !== 'undefined' ? '(IPC OK)' : '(IPC missing)')

async function bootstrap(): Promise<void> {
  await initI18n()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()
