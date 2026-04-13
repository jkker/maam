import 'temporal-polyfill/global'

// Currently missing from typescript library types for Intl.DurationFormat
// See https://github.com/microsoft/TypeScript/issues/60608

const dateTimeFormats = {
  full: {
    dateStyle: 'full',
    timeStyle: 'long',
  },
  long: {
    dateStyle: 'long',
    timeStyle: 'short',
  },
  medium: {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
  short: {
    dateStyle: 'short',
    timeStyle: 'short',
  },
  dateOnly: {
    dateStyle: 'long',
  },
  timeOnly: {
    timeStyle: 'short',
  },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>
type DateTimeFormatStyle = keyof typeof dateTimeFormats

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
})

const durationFormat = new Intl.DurationFormat(undefined, {
  style: 'long',
})

const numberFormats = {
  currency: new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }),
  decimal: new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  percent: new Intl.NumberFormat(undefined, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
}

export function formatDateTime(
  dateTime: Temporal.PlainDateTime | Temporal.ZonedDateTime | string,
  style: DateTimeFormatStyle = 'medium',
  timeZone?: string,
): string {
  const dt = typeof dateTime === 'string' ? Temporal.PlainDateTime.from(dateTime) : dateTime
  if (dt instanceof Temporal.ZonedDateTime) {
    return dt.toLocaleString(undefined, dateTimeFormats[style])
  }
  const zoned =
    dt instanceof Temporal.ZonedDateTime
      ? dt
      : timeZone
        ? dt.toZonedDateTime(timeZone)
        : dt.toZonedDateTime(Temporal.Now.timeZoneId())
  return zoned.toLocaleString(undefined, dateTimeFormats[style])
}

export function formatRelativeTime(
  dateTime: Temporal.PlainDateTime | string,
  baseDateTime?: Temporal.PlainDateTime | string,
): string {
  const dt = typeof dateTime === 'string' ? Temporal.PlainDateTime.from(dateTime) : dateTime
  const base = baseDateTime
    ? typeof baseDateTime === 'string'
      ? Temporal.PlainDateTime.from(baseDateTime)
      : baseDateTime
    : Temporal.Now.plainDateTimeISO()

  const diff = dt.until(base, { largestUnit: 'days' })

  if (Math.abs(diff.days) > 7) {
    return formatDateTime(dateTime, 'dateOnly')
  }

  if (Math.abs(diff.days) >= 1) {
    return relativeTimeFormat.format(-diff.days, 'day')
  }

  if (Math.abs(diff.hours) >= 1) {
    return relativeTimeFormat.format(-diff.hours, 'hour')
  }

  if (Math.abs(diff.minutes) >= 1) {
    return relativeTimeFormat.format(-diff.minutes, 'minute')
  }

  return relativeTimeFormat.format(-Math.floor(diff.seconds), 'second')
}

export function formatDuration(duration: Temporal.Duration | string): string {
  const dur = typeof duration === 'string' ? Temporal.Duration.from(duration) : duration
  return durationFormat.format(dur)
}

export function calculateDuration(
  start: Temporal.PlainDateTime | string,
  end: Temporal.PlainDateTime | string,
): Temporal.Duration {
  const startDt = typeof start === 'string' ? Temporal.PlainDateTime.from(start) : start
  const endDt = typeof end === 'string' ? Temporal.PlainDateTime.from(end) : end
  return startDt.until(endDt)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const format =
    currency === 'USD'
      ? numberFormats.currency
      : new Intl.NumberFormat(undefined, { style: 'currency', currency })
  return format.format(amount)
}

export function formatNumber(value: number, decimals = 2): string {
  const format =
    decimals === 2
      ? numberFormats.decimal
      : new Intl.NumberFormat(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
  return format.format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  const formatted = numberFormats.percent.format(value / 100)
  return decimals === 1 && formatted.endsWith('.0%') ? formatted.replace('.0%', '%') : formatted
}

export function isOverdue(dueDate: Temporal.PlainDateTime | string): boolean {
  const due = typeof dueDate === 'string' ? Temporal.PlainDateTime.from(dueDate) : dueDate
  return Temporal.PlainDateTime.compare(due, Temporal.Now.plainDateTimeISO()) < 0
}

export function isDueSoon(dueDate: Temporal.PlainDateTime | string, daysThreshold = 3): boolean {
  const due = typeof dueDate === 'string' ? Temporal.PlainDateTime.from(dueDate) : dueDate
  const now = Temporal.Now.plainDateTimeISO()
  const diff = now.until(due)
  return !isOverdue(dueDate) && diff.days <= daysThreshold
}

export function getDaysUntil(dueDate: Temporal.PlainDateTime | string): number {
  const due = typeof dueDate === 'string' ? Temporal.PlainDateTime.from(dueDate) : dueDate
  const now = Temporal.Now.plainDateTimeISO()
  const diff = now.until(due, { largestUnit: 'days' })
  return diff.days
}

export function addBusinessDays(
  date: Temporal.PlainDateTime | string,
  days: number,
): Temporal.PlainDateTime {
  const dt = typeof date === 'string' ? Temporal.PlainDateTime.from(date) : date
  let result = dt
  let remainingDays = days

  while (remainingDays > 0) {
    result = result.add({ days: 1 })
    const dayOfWeek = result.dayOfWeek
    if (dayOfWeek !== 6 && dayOfWeek !== 7) {
      remainingDays--
    }
  }

  while (remainingDays < 0) {
    result = result.subtract({ days: 1 })
    const dayOfWeek = result.dayOfWeek
    if (dayOfWeek !== 6 && dayOfWeek !== 7) {
      remainingDays++
    }
  }

  return result
}

export function getWeekStart(date: Temporal.PlainDateTime | string): Temporal.PlainDateTime {
  const dt = typeof date === 'string' ? Temporal.PlainDateTime.from(date) : date
  const dayOfWeek = dt.dayOfWeek
  return dt.subtract({ days: dayOfWeek - 1 })
}

export function getMonthStart(date: Temporal.PlainDateTime | string): Temporal.PlainDateTime {
  const dt = typeof date === 'string' ? Temporal.PlainDateTime.from(date) : date
  return dt.with({ day: 1 })
}

export function isToday(date: Temporal.PlainDateTime | string): boolean {
  const dt = typeof date === 'string' ? Temporal.PlainDateTime.from(date) : date
  const today = Temporal.Now.plainDateTimeISO()
  return dt.year === today.year && dt.month === today.month && dt.day === today.day
}

export function isSameDay(
  date1: Temporal.PlainDateTime | string,
  date2: Temporal.PlainDateTime | string,
): boolean {
  const dt1 = typeof date1 === 'string' ? Temporal.PlainDateTime.from(date1) : date1
  const dt2 = typeof date2 === 'string' ? Temporal.PlainDateTime.from(date2) : date2
  return dt1.year === dt2.year && dt1.month === dt2.month && dt1.day === dt2.day
}
