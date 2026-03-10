import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initI18n } from './i18n'
import './styles/globals.css'

// 诊断：若控制台能看到此行，说明外壳渲染进程已加载
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
