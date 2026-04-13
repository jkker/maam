import { beforeEach, expect, test, vi } from 'vite-plus/test'

/** Serialize a theme value in zustand persist format */
const persistedTheme = (theme: string) => JSON.stringify({ state: { theme }, version: 0 })

const setupThemeDom = ({
  matches = false,
  storedTheme,
}: {
  matches?: boolean
  storedTheme?: string
}) => {
  const classNames = new Set<string>()
  const storage: Record<string, string> = {}

  if (storedTheme !== undefined) {
    storage['theme'] = persistedTheme(storedTheme)
  }

  const mediaQueryListeners: Array<(e: { matches: boolean }) => void> = []
  const localStorage = {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
  }
  const matchMedia = vi.fn(() => ({
    matches,
    addEventListener: vi.fn((_: string, handler: (e: { matches: boolean }) => void) => {
      mediaQueryListeners.push(handler)
    }),
    removeEventListener: vi.fn(),
  }))
  const classList = {
    add: (...tokens: string[]) => {
      for (const token of tokens) classNames.add(token)
    },
    remove: (...tokens: string[]) => {
      for (const token of tokens) classNames.delete(token)
    },
  }
  const style: Record<string, string> = {}
  const document = { documentElement: { classList, style } }
  const window = { document, localStorage, matchMedia }

  Reflect.set(globalThis, 'document', document)
  Reflect.set(globalThis, 'window', window)
  Reflect.set(globalThis, 'localStorage', localStorage)

  return {
    classNames,
    localStorage,
    storage,
    style,
    simulateSystemThemeChange: (dark: boolean) => {
      matchMedia.mockReturnValue({
        matches: dark,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      for (const listener of mediaQueryListeners) {
        listener({ matches: dark })
      }
    },
  }
}

/** Flush async zustand persist rehydration (microtask-based) */
const flushRehydration = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

// --- Rehydration behavior ---

test('resolves to system preference when no stored theme (dark system)', async () => {
  const { classNames, style } = setupThemeDom({ matches: true })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('system')
  expect(themeStore.get('systemTheme')).toBe('dark')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
  expect(classNames.has('light')).toBe(false)
  expect(style.colorScheme).toBe('dark')
})

test('resolves to system preference when no stored theme (light system)', async () => {
  const { classNames, style } = setupThemeDom({ matches: false })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('system')
  expect(themeStore.get('systemTheme')).toBe('light')
  expect(themeStore.get('resolvedTheme')).toBe('light')
  expect(classNames.has('light')).toBe(true)
  expect(style.colorScheme).toBe('light')
})

test('resolves stored dark theme regardless of system preference', async () => {
  const { classNames, style } = setupThemeDom({ matches: false, storedTheme: 'dark' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('dark')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
  expect(classNames.has('light')).toBe(false)
  expect(style.colorScheme).toBe('dark')
})

test('resolves stored light theme regardless of system preference', async () => {
  const { classNames } = setupThemeDom({ matches: true, storedTheme: 'light' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('light')
  expect(themeStore.get('resolvedTheme')).toBe('light')
  expect(classNames.has('light')).toBe(true)
  expect(classNames.has('dark')).toBe(false)
})

test('resolves stored system theme to system preference', async () => {
  const { classNames } = setupThemeDom({ matches: true, storedTheme: 'system' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('system')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
})

test('falls back to system when stored value is invalid', async () => {
  const { classNames } = setupThemeDom({ matches: true, storedTheme: 'sepia' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('theme')).toBe('system')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
  expect(classNames.has('light')).toBe(false)
})

// --- Actions ---

test('setTheme updates state, applies to DOM, and persists', async () => {
  const { classNames, storage, style } = setupThemeDom({ matches: true })
  const { setTheme, themeStore } = await import('#/stores/theme')
  await flushRehydration()

  setTheme('light')

  expect(themeStore.get('theme')).toBe('light')
  expect(themeStore.get('resolvedTheme')).toBe('light')
  expect(classNames.has('light')).toBe(true)
  expect(classNames.has('dark')).toBe(false)
  expect(style.colorScheme).toBe('light')

  // Verify zustand persist saved to localStorage
  const stored = JSON.parse(storage['theme']) as { state: { theme: string } }
  expect(stored.state.theme).toBe('light')
})

test('toggleTheme flips from dark to light', async () => {
  const { classNames } = setupThemeDom({ matches: false, storedTheme: 'dark' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('resolvedTheme')).toBe('dark')

  themeStore.actions.toggleTheme()

  expect(themeStore.get('theme')).toBe('light')
  expect(themeStore.get('resolvedTheme')).toBe('light')
  expect(classNames.has('light')).toBe(true)
})

test('toggleTheme flips from light to dark', async () => {
  const { classNames } = setupThemeDom({ matches: false, storedTheme: 'light' })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('resolvedTheme')).toBe('light')

  themeStore.actions.toggleTheme()

  expect(themeStore.get('theme')).toBe('dark')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
})

// --- System theme changes ---

test('system preference change updates resolvedTheme when using system theme', async () => {
  const { classNames, simulateSystemThemeChange } = setupThemeDom({ matches: false })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  expect(themeStore.get('resolvedTheme')).toBe('light')

  simulateSystemThemeChange(true)

  expect(themeStore.get('systemTheme')).toBe('dark')
  expect(themeStore.get('resolvedTheme')).toBe('dark')
  expect(classNames.has('dark')).toBe(true)
})

test('system preference change does not affect explicit theme', async () => {
  const { classNames, simulateSystemThemeChange } = setupThemeDom({
    matches: false,
    storedTheme: 'light',
  })
  const { themeStore } = await import('#/stores/theme')
  await flushRehydration()

  simulateSystemThemeChange(true)

  expect(themeStore.get('theme')).toBe('light')
  expect(themeStore.get('resolvedTheme')).toBe('light')
  expect(classNames.has('light')).toBe(true)
})
