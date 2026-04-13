import { type } from 'arktype'
import { createStore, useStoreValue } from 'zustand-x'

import { checkMediaQuery, subscribeToMediaQuery } from '#/hooks/use-media-query'

const MEDIA_QUERY = '(prefers-color-scheme: dark)'
const ThemeValue = type("'dark' | 'light' | 'system'")

export type Theme = typeof ThemeValue.infer
export type ResolvedTheme = Exclude<Theme, 'system'>

const resolveTheme = (theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme =>
  theme === 'system' ? systemTheme : theme

const applyTheme = (resolvedTheme: ResolvedTheme) => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
  root.style.colorScheme = resolvedTheme
}

/**
 * Shared theme store for app-wide preference and resolved color mode.
 * @remarks Uses zustand persist with `onRehydrateStorage` to safely initialize
 * after hydration. An inline script in index.html prevents FOUC.
 */
export const themeStore = createStore(
  { theme: 'system' as Theme, systemTheme: 'light' as ResolvedTheme },
  {
    name: 'theme',
    persist: {
      enabled: true,
      partialize: (state: { theme: Theme; systemTheme: ResolvedTheme }) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => () => {
        // Deferred: themeStore variable isn't assigned yet during
        // synchronous persist hydration (toThenable chain).
        queueMicrotask(() => {
          // Validate rehydrated theme — reject unknown values
          const raw = themeStore.get('theme')
          if (ThemeValue(raw) instanceof type.errors) {
            themeStore.set('theme', 'system')
          }

          const systemTheme: ResolvedTheme = checkMediaQuery(MEDIA_QUERY) ? 'dark' : 'light'
          themeStore.set('systemTheme', systemTheme)
          applyTheme(resolveTheme(themeStore.get('theme'), systemTheme))

          subscribeToMediaQuery(MEDIA_QUERY, (matches) =>
            themeStore.actions.setSystemTheme(matches ? 'dark' : 'light'),
          )
        })
      },
    },
  },
)
  .extendSelectors(({ get }) => ({
    resolvedTheme: () => resolveTheme(get('theme'), get('systemTheme')),
  }))
  .extendSelectors(({ get }) => ({
    isDark: () => get('resolvedTheme') === 'dark',
  }))
  .extendActions(({ get, set }) => ({
    setTheme: (theme: Theme) => {
      set('theme', theme)
      applyTheme(resolveTheme(theme, get('systemTheme')))
    },
    setSystemTheme: (systemTheme: ResolvedTheme) => {
      set('systemTheme', systemTheme)
      applyTheme(resolveTheme(get('theme'), systemTheme))
    },
  }))
  .extendActions(({ get, actions }) => ({
    toggleTheme: () => {
      actions.setTheme(get('resolvedTheme') === 'dark' ? 'light' : 'dark')
    },
  }))

/**
 * Persists a user theme preference into the shared store.
 * @remarks Use `'system'` to follow the operating system color scheme.
 */
export const setTheme = themeStore.actions.setTheme

/**
 * Returns the current theme preference, resolved theme, and setter.
 * @remarks `resolvedTheme` is always either `'light'` or `'dark'`.
 */
export const useTheme = () => {
  const theme = useStoreValue(themeStore, 'theme')
  const resolvedTheme = useStoreValue(themeStore, 'resolvedTheme')

  return {
    theme,
    resolvedTheme,
    setTheme,
  }
}
