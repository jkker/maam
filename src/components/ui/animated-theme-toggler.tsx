import { Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { useStoreValue } from 'zustand-x'

import { cn } from '#/lib/utils'
import { themeStore } from '#/stores/theme'

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<'button'> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const isDark = useStoreValue(themeStore, 'isDark')
  const buttonRef = useRef<HTMLButtonElement>(null)

  const toggleTheme = () => {
    const button = buttonRef.current
    if (!button) return

    const { top, left, width, height } = button.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y))

    if (typeof document.startViewTransition !== 'function') {
      themeStore.actions.toggleTheme()
      return
    }

    const transition = document.startViewTransition(() =>
      flushSync(() => themeStore.actions.toggleTheme()),
    )

    void transition.ready.then(() =>
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
        },
        {
          duration,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
  }

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
