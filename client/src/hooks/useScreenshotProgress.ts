import { useEffect, useMemo, useRef, useState } from 'react'

interface ScreenshotProgressState {
  /** Estimated interval in seconds */
  estimatedInterval: number | null
  /** Time remaining until next screenshot (seconds) */
  timeRemaining: number
  /** Progress percentage (0-100) */
  progress: number
  /** Whether the estimate is stable (has enough samples) */
  isStable: boolean
}

/**
 * Hook to manage screenshot progress bar state with robust interval estimation
 * Uses exponential moving average for smooth, stable progress tracking
 */
export function useScreenshotProgress(
  screenshotData?: { screenshot?: string; timestamp?: string },
  serverInterval?: number | null,
): ScreenshotProgressState {
  const lastScreenshotTimeRef = useRef<number | null>(null)
  const [estimatedInterval, setEstimatedInterval] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [sampleCount, setSampleCount] = useState(0)
  const screenshotIdRef = useRef<string | null>(null)

  // Detect new screenshot and update interval estimate
  const currentScreenshotId = screenshotData?.screenshot
    ? `${screenshotData.screenshot.slice(0, 20)}-${screenshotData.timestamp}`
    : null

  useEffect(() => {
    if (!screenshotData?.screenshot || !screenshotData?.timestamp) return

    // Only process if this is a new screenshot
    if (currentScreenshotId === screenshotIdRef.current) return
    screenshotIdRef.current = currentScreenshotId

    const screenshotTime = new Date(screenshotData.timestamp).getTime()
    const lastTime = lastScreenshotTimeRef.current

    // Calculate interval from time between screenshots
    if (lastTime) {
      const measuredInterval = (screenshotTime - lastTime) / 1000 // Convert to seconds

      setEstimatedInterval((prev) => {
        // Use exponential moving average for stability
        // Weight: 0.3 for new value, 0.7 for historical (reduces fluctuations)
        const newInterval = prev === null ? measuredInterval : prev * 0.7 + measuredInterval * 0.3
        // Reset countdown when interval changes
        setTimeRemaining(newInterval)
        return newInterval
      })

      setSampleCount((prev) => Math.min(prev + 1, 10)) // Cap at 10 for "stable" indication
    } else {
      // First screenshot - use server interval if available
      if (serverInterval) {
        setEstimatedInterval(serverInterval)
        setTimeRemaining(serverInterval)
        setSampleCount(1)
      }
    }

    lastScreenshotTimeRef.current = screenshotTime
  }, [currentScreenshotId, screenshotData?.screenshot, screenshotData?.timestamp, serverInterval])

  // Countdown timer - updates every 100ms for smooth animation
  useEffect(() => {
    if (!estimatedInterval || estimatedInterval <= 0) return

    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 0.1
        // Don't go below 0, reset to estimated interval when it would go negative
        if (next <= 0) {
          return estimatedInterval
        }
        return next
      })
    }, 100)

    return () => clearInterval(intervalId)
  }, [estimatedInterval])

  // Calculate progress percentage (inverse of time remaining)
  const progress = useMemo(() => {
    if (!estimatedInterval) return 0
    return Math.max(
      0,
      Math.min(100, ((estimatedInterval - timeRemaining) / estimatedInterval) * 100),
    )
  }, [estimatedInterval, timeRemaining])

  // Consider stable after 3+ samples
  const isStable = sampleCount >= 3

  return {
    estimatedInterval,
    timeRemaining: Math.max(0, timeRemaining),
    progress,
    isStable,
  }
}
