import { useCallback, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'meridian.theme.v1'

function current(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference is a convenience; losing it must not break the page.
    }
  }, [])

  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), [setTheme])

  return { theme, setTheme, toggle }
}
