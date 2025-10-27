const tz = Temporal.Now.timeZoneId()
const locale = undefined

// Utility functions for formatting
export function formatDuration(arg?: number | Temporal.DurationLike | Temporal.Duration) {
  if (!arg) return 'N/A'
  const d = Temporal.Duration.from(
    typeof arg === 'number' ? { milliseconds: Math.round(arg) } : arg,
  )

  for (const unit of ['day', 'hour', 'minute', 'second'] as const) {
    const total = d.total(unit)
    if (total >= 1) {
      return new Intl.NumberFormat(locale, {
        maximumSignificantDigits: 2,
        style: 'unit',
        unit,
        unitDisplay: 'narrow',
      }).format(total)
    }
  }
  return 'N/A'
}

export function formatTime(
  arg?: string | Temporal.ZonedDateTime | Temporal.ZonedDateTimeLike | Temporal.PlainDateTime,
) {
  if (!arg) return 'N/A'
  const date = Temporal.ZonedDateTime.from(arg).withTimeZone(tz)
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
}

export * from './lib/utils'
