/// <reference types="vite/client" />

import type { ElectronAPI } from '../shared/electron-api'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
