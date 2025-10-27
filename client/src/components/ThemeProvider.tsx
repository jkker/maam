import { useEffect, useState } from 'react'

import { ThemeProviderContext, type Theme } from '@/hooks/useTheme'

import { useMediaQuery } from '../hooks/useMediaQuery'

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      return root.classList.add(isDarkMode ? 'dark' : 'light')
    }

    root.classList.add(theme)
  }, [theme, isDarkMode])

  return (
    <ThemeProviderContext.Provider
      {...props}
      value={{
        theme,
        resolvedTheme: theme === 'system' ? (isDarkMode ? 'dark' : 'light') : theme,
        setTheme: (theme) => {
          localStorage.setItem(storageKey, theme)
          setTheme(theme)
        },
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}
