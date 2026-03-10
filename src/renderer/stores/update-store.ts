import { create } from 'zustand'

export interface UpdateNoticeInfo {
  version: string
  releaseNotes?: string
  publishedAt?: string
}

interface UpdateNoticeState {
  available: boolean
  info: UpdateNoticeInfo | null
  dismissed: boolean
  setUpdateAvailable: (info: UpdateNoticeInfo) => void
  dismissUpdateNotice: () => void
  resetDismissed: () => void
}

export const useUpdateNoticeStore = create<UpdateNoticeState>((set) => ({
  available: false,
  info: null,
  dismissed: false,
  setUpdateAvailable: (info) =>
    set(() => ({
      available: true,
      info,
      dismissed: false,
    })),
  dismissUpdateNotice: () =>
    set((state) => ({
      ...state,
      dismissed: true,
    })),
  resetDismissed: () =>
    set((state) => ({
      ...state,
      dismissed: false,
    })),
}))
