import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export const ThemeProviderContext = createContext<{
  theme: Theme
  resolvedTheme: Exclude<Theme, 'system'>
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
})

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
