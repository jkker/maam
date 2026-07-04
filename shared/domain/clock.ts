/**
 * Clock abstraction for testable time handling.
 */
export interface Clock {
  /** Get current time in milliseconds */
  now(): number
  /** Get current time as ISO string */
  nowIso(): string
}

/**
 * Real clock using system time.
 */
export const realClock: Clock = {
  now: () => Date.now(),
  nowIso: () => new Date().toISOString(),
}

/**
 * Test time scale factors.
 * 1 hour virtual = 1 second wall clock
 */
export const TEST_SCALE = {
  hour: 1000,
  minute: 1000 / 60,
  second: 1000 / 3600,
  ms: 1 / 3600,
} as const

/**
 * Creates a controllable fake clock for testing.
 * Time advances in scaled virtual time.
 */
export function createFakeClock(startTime = 0): FakeClock {
  let currentTime = startTime

  return {
    now: () => currentTime,
    nowIso: () => new Date(currentTime).toISOString(),
    advance: (ms: number) => {
      currentTime += ms
    },
    advanceVirtual: (virtualMs: number) => {
      // In tests, 1 hour = 1 second, so divide by 3600
      currentTime += virtualMs
    },
    set: (time: number) => {
      currentTime = time
    },
  }
}

export interface FakeClock extends Clock {
  /** Advance clock by real milliseconds */
  advance(ms: number): void
  /** Advance clock by virtual milliseconds (uses test scaling) */
  advanceVirtual(virtualMs: number): void
  /** Set clock to specific time */
  set(time: number): void
}
