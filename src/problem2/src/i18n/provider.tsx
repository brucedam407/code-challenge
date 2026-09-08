import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, LOCALES, detect, interpolate, readStored, STORAGE_KEY } from './context'
import type { I18nValue, Locale } from './context'
import { en } from './messages'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored() ?? detect())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.documentElement.lang = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  const value = useMemo<I18nValue>(() => {
    const { messages, intl } = LOCALES[locale]
    return {
      locale,
      setLocale,
      intl,
      t: (key, vars) => interpolate(messages[key] ?? en[key], vars),
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
