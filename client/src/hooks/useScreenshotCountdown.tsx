import { useEffect, useState } from 'react'

/**
 * Hook to track countdown progress for screenshot refresh
 * @param intervalSeconds - Estimated refresh interval in seconds (integer)
 * @param lastUpdateTimestamp - ISO 8601 timestamp of last screenshot update
 * @returns Object with progress percentage (0-100) and remaining time in milliseconds
 */
export function useScreenshotCountdown(
  intervalSeconds: number | null | undefined,
  lastUpdateTimestamp: string | null | undefined,
) {
  const [progress, setProgress] = useState(0)
  const [remainingMs, setRemainingMs] = useState<number>(0)

  useEffect(() => {
    // Validate inputs - early return without setting state
    if (!intervalSeconds || !lastUpdateTimestamp) {
      return
    }

    const intervalMs = intervalSeconds * 1000
    const lastUpdateMs = new Date(lastUpdateTimestamp).getTime()

    // Check if timestamp is valid
    if (isNaN(lastUpdateMs)) {
      console.warn('Invalid timestamp:', lastUpdateTimestamp)
      return
    }

    const updateProgress = () => {
      const now = Date.now()
      const elapsed = now - lastUpdateMs
      const remaining = Math.max(0, intervalMs - elapsed)
      const progressPercent = Math.min(100, (elapsed / intervalMs) * 100)

      setProgress(progressPercent)
      setRemainingMs(remaining)
    }

    // Update immediately
    updateProgress()

    // Update every 100ms for smooth animation
    const intervalId = setInterval(updateProgress, 100)

    return () => clearInterval(intervalId)
  }, [intervalSeconds, lastUpdateTimestamp])

  // When inputs are invalid, return zero values without setting state in effect
  if (!intervalSeconds || !lastUpdateTimestamp) {
    return { progress: 0, remainingMs: 0 }
  }

  return { progress, remainingMs }
}
