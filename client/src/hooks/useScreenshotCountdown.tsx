import { useEffect, useMemo, useState } from 'react'

/**
 * Hook to track countdown progress for screenshot refresh
 * @param intervalMs - Estimated refresh interval in milliseconds
 * @param lastUpdateTimestamp - Timestamp of last screenshot update
 * @returns Object with progress percentage (0-100) and remaining time in milliseconds
 */
export function useScreenshotCountdown(intervalMs?: number, lastUpdateTimestamp?: string) {
  // Only store valid data or null
  const validData = useMemo(() => {
    if (!intervalMs || !lastUpdateTimestamp) return null
    return { intervalMs, lastUpdateTimestamp }
  }, [intervalMs, lastUpdateTimestamp])

  const [progress, setProgress] = useState(0)
  const [remainingMs, setRemainingMs] = useState<number>(0)

  useEffect(() => {
    if (!validData) return

    const updateProgress = () => {
      const now = Date.now()
      const lastUpdate = new Date(validData.lastUpdateTimestamp).getTime()
      const elapsed = now - lastUpdate
      const remaining = Math.max(0, validData.intervalMs - elapsed)
      const progressPercent = Math.min(100, (elapsed / validData.intervalMs) * 100)

      setProgress(progressPercent)
      setRemainingMs(remaining)
    }

    // Update immediately
    updateProgress()

    // Update every 100ms for smooth animation
    const intervalId = setInterval(updateProgress, 100)

    return () => clearInterval(intervalId)
  }, [validData])

  // Return zero values when no valid data
  if (!validData) {
    return { progress: 0, remainingMs: 0 }
  }

  return { progress, remainingMs }
}
