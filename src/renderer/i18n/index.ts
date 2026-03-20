/**
 * Shell i18n: resolve locale via Electron, load matching bundle.
 * Bundles: en, zh-CN, zh-TW, fr, ja, ko, es
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import es from './locales/es.json'

const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW', 'fr', 'ja', 'ko', 'es'] as const
const DEFAULT_LOCALE = 'en'

/** Map Electron locale string to a supported language code */
function normalizeLocale(electronLocale: string): string {
  const lower = electronLocale.toLowerCase()
  if (lower.startsWith('zh')) {
    if (lower.includes('tw') || lower.includes('hk') || lower.includes('hant')) return 'zh-TW'
    return 'zh-CN'
  }
  if (lower.startsWith('fr')) return 'fr'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('ko')) return 'ko'
  if (lower.startsWith('es')) return 'es'
  if (SUPPORTED_LOCALES.includes(lower as (typeof SUPPORTED_LOCALES)[number])) {
    return lower
  }
  return DEFAULT_LOCALE
}

/** Fetch system locale over IPC for i18n init */
async function detectLocale(): Promise<string> {
  if (typeof window.electronAPI?.systemGetLocale === 'function') {
    try {
      const locale = await window.electronAPI.systemGetLocale()
      return normalizeLocale(locale)
    } catch {
      // fallback
    }
  }
  // Fallback: navigator.language (usually matches OS in Chromium)
  return normalizeLocale(navigator.language)
}

export async function initI18n(): Promise<void> {
  const lng = await detectLocale()

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      fr: { translation: fr },
      ja: { translation: ja },
      ko: { translation: ko },
      es: { translation: es },
    },
    lng,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false, // React escapes content
    },
    react: {
      useSuspense: false, // Avoid first-paint flash
    },
  })
}

export default i18n
