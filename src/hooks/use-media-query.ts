import { useEffect, useState } from 'react'

/**
 * Evaluates a media query against the current window.
 * @remarks Returns `false` during non-browser execution.
 */
export const checkMediaQuery = (q: string): boolean => {
  if (typeof window !== 'undefined') {
    return window.matchMedia(q).matches
  }
  return false
}

/**
 * Subscribes to media query changes with a minimal browser-safe wrapper.
 * @remarks Returns a no-op cleanup function during non-browser execution.
 */
export const subscribeToMediaQuery = (
  query: string,
  listener: (matches: boolean) => void,
): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(query)
  const handler = ({ matches }: MediaQueryListEvent) => listener(matches)

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => checkMediaQuery(query))

  useEffect(() => subscribeToMediaQuery(query, setMatches), [query])

  return matches
}
