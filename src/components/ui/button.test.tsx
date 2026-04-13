import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { render, renderHook } from 'vitest-browser-react'

import { useCopyToClipboard } from '#/hooks/use-copy-to-clipboard'
import { cn } from '#/lib/utils'

import { Button } from './button'

describe('vitest-browser-react: Component Testing', () => {
  test('renders button with default props', async () => {
    const screen = await render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })

    await expect.element(button).toBeVisible()
    expect(button).toHaveTextContent('Click me')
  })

  test('renders different button variants', async () => {
    const screen = await render(
      <div>
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>,
    )

    await expect.element(screen.getByRole('button', { name: 'Default' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Outline' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Destructive' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Link' })).toBeVisible()
  })

  test('handles click events', async () => {
    const handleClick = vi.fn()
    const screen = await render(<Button onClick={handleClick}>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })

    await button.click()

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('snapshot testing', async () => {
    const screen = await render(
      <Button variant="outline" size="lg">
        Test Button
      </Button>,
    )

    expect(screen.container).toMatchInlineSnapshot(`
      <div>
        <button
          class="group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3"
          data-slot="button"
          tabindex="0"
          type="button"
        >
          Test Button
        </button>
      </div>
    `)
  })
})

describe('vitest-browser-react: Hook Testing', () => {
  test('useCopyToClipboard returns initial state', async () => {
    const { result } = await renderHook(useCopyToClipboard)

    expect(result.current.text).toBeUndefined()
    expect(result.current.isCopied).toBe(false)
  })

  test('useCopyToClipboard copies text successfully', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    const { result, act } = await renderHook(useCopyToClipboard)

    let success = false
    await act(async () => {
      success = await result.current.copy('Hello, World!')
    })

    expect(success).toBe(true)
    expect(result.current.text).toBe('Hello, World!')
    expect(result.current.isCopied).toBe(true)
  })

  test('useCopyToClipboard handles clipboard errors', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Copy failed')) },
    })

    const { result, act } = await renderHook(useCopyToClipboard)

    let success = true
    await act(async () => {
      success = await result.current.copy('Test')
    })

    expect(success).toBe(false)
    expect(result.current.text).toBeUndefined()
    expect(result.current.isCopied).toBe(false)
  })

  test('useCopyToClipboard clears copied text after timeout', async () => {
    vi.useFakeTimers()

    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    const { result, act } = await renderHook(useCopyToClipboard)

    await act(async () => {
      await result.current.copy('Test', { timeout: 1000 })
    })

    expect(result.current.isCopied).toBe(true)

    await act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.isCopied).toBe(false)

    vi.useRealTimers()
  })
})

describe('Mocking: vi.fn() and Function Spies', () => {
  test('vi.fn() creates mock function', () => {
    const mockFn = vi.fn()

    mockFn('arg1', 'arg2')

    expect(mockFn).toHaveBeenCalled()
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
    expect(mockFn.mock.calls).toEqual([['arg1', 'arg2']])
  })

  test('vi.fn() with implementation', () => {
    const mockFn = vi.fn((a: number, b: number) => a + b)

    const result = mockFn(2, 3)

    expect(result).toBe(5)
    expect(mockFn).toHaveBeenCalledWith(2, 3)
  })

  test('vi.spyOn() spies on object methods', () => {
    const obj = {
      greet: (name: string) => `Hello, ${name}!`,
    }

    const spy = vi.spyOn(obj, 'greet')
    obj.greet('World')

    expect(spy).toHaveBeenCalledWith('World')
    expect(spy).toHaveReturnedWith('Hello, World!')

    spy.mockRestore()
  })

  test('vi.spyOn() with mockReturnValue', () => {
    const obj = {
      getValue: () => 42,
    }

    vi.spyOn(obj, 'getValue').mockReturnValue(100)

    expect(obj.getValue()).toBe(100)

    vi.restoreAllMocks()
  })
})

describe('Mocking: Environment and Globals', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VITE_API_URL', 'https://test.api.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('vi.stubEnv() sets environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(import.meta.env.VITE_API_URL).toBe('https://test.api.com')
  })
})

describe('Mocking: Date and Time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('vi.setSystemTime() sets current time', () => {
    const testDate = new Date('2024-01-01T00:00:00Z')
    vi.setSystemTime(testDate)

    expect(new Date()).toEqual(testDate)
  })

  test('vi.advanceTimersByTime() advances fake timers', () => {
    let count = 0

    setTimeout(() => {
      count++
    }, 1000)

    expect(count).toBe(0)

    vi.advanceTimersByTime(1000)

    expect(count).toBe(1)
  })

  test('timer with async operations', async () => {
    let executed = false

    setTimeout(() => {
      executed = true
    }, 500)

    vi.advanceTimersByTime(500)

    expect(executed).toBe(true)
  })
})

describe('Mocking: Advanced Timer Operations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('multiple timers execute in correct order', () => {
    const order: number[] = []

    setTimeout(() => order.push(1), 100)
    setTimeout(() => order.push(2), 50)
    setTimeout(() => order.push(3), 200)

    vi.advanceTimersByTime(100)
    expect(order).toEqual([2, 1])

    vi.advanceTimersByTime(100)
    expect(order).toEqual([2, 1, 3])
  })

  test('clearTimeout prevents callback execution', () => {
    let executed = false

    const timeoutId = setTimeout(() => {
      executed = true
    }, 100)

    clearTimeout(timeoutId)

    vi.advanceTimersByTime(100)

    expect(executed).toBe(false)
  })
})

describe('Pure Utility Functions', () => {
  test('cn merges class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2')
    expect(cn('class1', null, 'class2')).toBe('class1 class2')
    expect(cn('class1 class2', 'class3')).toBe('class1 class2 class3')
    expect(cn('px-2 px-4')).toBe('px-4')
  })
})

describe('Component Integration Tests', () => {
  test('disabled button has disabled attribute', async () => {
    const handleClick = vi.fn()
    const screen = await render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Disabled' })

    expect(button).toBeDisabled()
  })

  test('button with custom className', async () => {
    const screen = await render(<Button className="custom-class">Custom Button</Button>)
    const button = screen.getByRole('button', { name: 'Custom Button' })

    expect(button).toHaveClass('custom-class')
  })

  test('button different sizes', async () => {
    const screen = await render(
      <div>
        <Button size="xs">XS</Button>
        <Button size="sm">SM</Button>
        <Button size="default">Default</Button>
        <Button size="lg">LG</Button>
      </div>,
    )

    await expect.element(screen.getByRole('button', { name: 'XS' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'SM' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Default' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'LG' })).toBeVisible()
  })
})
