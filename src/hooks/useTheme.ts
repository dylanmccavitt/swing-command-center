import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'scc-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  return saved === 'light' ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return { theme, setTheme: setThemeState, toggleTheme }
}
