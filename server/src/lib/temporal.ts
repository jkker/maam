import 'temporal-polyfill/global'

const defaultTimeZone = Temporal.Now.timeZoneId()
export const getNow = (tz = defaultTimeZone) => Temporal.Now.instant().toZonedDateTimeISO(tz)

const locale = undefined

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
  const date = Temporal.ZonedDateTime.from(arg).withTimeZone(defaultTimeZone)
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
}
