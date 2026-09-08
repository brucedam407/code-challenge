import { createContext, useContext } from 'react'
import { LOCALES, en, type Locale, type MessageKey } from './messages'

const STORAGE_KEY = 'meridian.locale.v1'

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
  intl: string
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

function readStored(): Locale | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw && raw in LOCALES ? (raw as Locale) : null
  } catch {
    return null
  }
}

/** First browser language we ship, else English. */
function detect(): Locale {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages || []
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (base in LOCALES) return base as Locale
  }
  return 'en'
}

/** English, so a component rendered without the provider still reads properly. */
const fallback: I18nValue = {
  locale: 'en',
  setLocale: () => {},
  t: (key, vars) => interpolate(en[key], vars),
  intl: 'en-US',
}

const I18nContext = createContext<I18nValue>(fallback)

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export { I18nContext, interpolate, readStored, detect, STORAGE_KEY }
export { LOCALES }
export type { Locale, MessageKey, I18nValue }
