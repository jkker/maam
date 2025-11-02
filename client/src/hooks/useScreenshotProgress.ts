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

// Algorithm constants
const EMA_ALPHA = 0.3 // Smoothing factor for exponential moving average (0 = all history, 1 = all new)
const MAX_SAMPLE_COUNT = 10 // Maximum number of samples to track for stability
const STABILITY_THRESHOLD = 3 // Minimum samples needed for stable estimate
const PROGRESS_UPDATE_INTERVAL_MS = 100 // How often to update countdown (10fps)

/**
 * Hook to manage screenshot progress bar state with robust interval estimation
 * Uses exponential moving average for smooth, stable progress tracking
 */
export function useScreenshotProgress(
  timestamp?: string,
  interval?: number,
): ScreenshotProgressState {
  const lastScreenshotTimeRef = useRef<number | null>(null)
  const [estimatedInterval, setEstimatedInterval] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [sampleCount, setSampleCount] = useState(0)

  useEffect(() => {
    if (!timestamp) return

    const screenshotTime = new Date(timestamp).getTime()
    const lastTime = lastScreenshotTimeRef.current

    // Calculate interval from time between screenshots
    if (lastTime) {
      const measuredInterval = (screenshotTime - lastTime) / 1000 // Convert to seconds

      setEstimatedInterval((prev) => {
        // Use exponential moving average for stability
        // Formula: newEstimate = (1 - alpha) * oldEstimate + alpha * newMeasurement
        const newInterval =
          prev === null ? measuredInterval : (1 - EMA_ALPHA) * prev + EMA_ALPHA * measuredInterval
        // Reset countdown when interval changes
        setTimeRemaining(newInterval)
        return newInterval
      })

      setSampleCount((prev) => Math.min(prev + 1, MAX_SAMPLE_COUNT))
    } else {
      // First screenshot - use server interval if available
      if (interval) {
        setEstimatedInterval(interval)
        setTimeRemaining(interval)
        setSampleCount(1)
      }
    }

    lastScreenshotTimeRef.current = screenshotTime
  }, [timestamp, interval])

  // Countdown timer - updates every PROGRESS_UPDATE_INTERVAL_MS for smooth animation
  useEffect(() => {
    if (!estimatedInterval || estimatedInterval <= 0) return

    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - PROGRESS_UPDATE_INTERVAL_MS / 1000
        // Don't go below 0, reset to estimated interval when it would go negative
        if (next <= 0) {
          return estimatedInterval
        }
        return next
      })
    }, PROGRESS_UPDATE_INTERVAL_MS)

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

  // Consider stable after STABILITY_THRESHOLD+ samples
  const isStable = sampleCount >= STABILITY_THRESHOLD

  return {
    estimatedInterval,
    timeRemaining: Math.max(0, timeRemaining),
    progress,
    isStable,
  }
}
