import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'spark-theme'

export function getInitialTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

/** State hook that keeps <html data-theme> and localStorage in sync. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  return [theme, setTheme]
}
