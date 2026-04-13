import 'temporal-polyfill/global'
import { expect, test, vi, beforeEach } from 'vite-plus/test'

import {
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  formatCurrency,
  formatNumber,
  formatPercent,
  isOverdue,
  isDueSoon,
  getDaysUntil,
  addBusinessDays,
  getWeekStart,
  getMonthStart,
  isToday,
  isSameDay,
  calculateDuration,
} from '#/lib/temporal-utils'

beforeEach(() => {
  vi.setSystemTime(new Date('2025-01-15T10:00:00'))
})

test('formats date and time', () => {
  const now = Temporal.PlainDateTime.from('2025-01-15T10:30:00')

  expect(formatDateTime(now, 'short')).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
  expect(formatDateTime(now, 'long')).toMatch(/January/)
})

test('formats relative time', () => {
  const now = Temporal.Now.plainDateTimeISO()
  const past = now.subtract({ hours: 2 })
  const future = now.add({ hours: 3 })

  expect(formatRelativeTime(past)).toMatch(/2 hours? ago/)
  expect(formatRelativeTime(future)).toMatch(/in 3 hours?/)
})

test('formats duration', () => {
  const duration = Temporal.Duration.from({ hours: 2, minutes: 30, seconds: 45 })
  const formatted = formatDuration(duration)

  expect(formatted).toMatch(/2 hours/)
  expect(formatted).toMatch(/30 minutes/)
})

test('calculates duration between two dates', () => {
  const start = Temporal.PlainDateTime.from('2025-01-15T10:00:00')
  const end = Temporal.PlainDateTime.from('2025-01-15T15:30:00')

  const duration = calculateDuration(start, end)

  expect(duration.hours).toBe(5)
  expect(duration.minutes).toBe(30)
})

test('formats currency', () => {
  expect(formatCurrency(1234.56)).toMatch(/\$1,234.56/)
  expect(formatCurrency(100)).toMatch(/\$100.00/)
})

test('formats numbers', () => {
  expect(formatNumber(Math.PI, 2)).toBe('3.14')
  expect(formatNumber(1000)).toBe('1,000.00')
})

test('formats percentages', () => {
  expect(formatPercent(75.5)).toMatch(/75.5%/)
  expect(formatPercent(100)).toMatch(/100%/)
})

test('checks if date is overdue', () => {
  const now = Temporal.Now.plainDateTimeISO()
  const past = now.subtract({ days: 1 })
  const future = now.add({ days: 1 })

  expect(isOverdue(past)).toBe(true)
  expect(isOverdue(future)).toBe(false)
})

test('checks if date is due soon', () => {
  const now = Temporal.Now.plainDateTimeISO()
  const soon = now.add({ days: 2 })
  const later = now.add({ days: 10 })

  expect(isDueSoon(soon, 3)).toBe(true)
  expect(isDueSoon(later, 3)).toBe(false)
})

test('gets days until a date', () => {
  const now = Temporal.Now.plainDateTimeISO()
  const future = now.add({ days: 5 })

  expect(getDaysUntil(future)).toBe(5)
})

test('adds business days excluding weekends', () => {
  const wednesday = Temporal.PlainDateTime.from('2025-01-15T10:00:00')

  const monday = addBusinessDays(wednesday, -2)
  const friday = addBusinessDays(wednesday, 2)

  expect(monday.dayOfWeek).toBe(1)
  expect(friday.dayOfWeek).toBe(5)
})

test('handles weekend boundary for business days', () => {
  const friday = Temporal.PlainDateTime.from('2025-01-17T10:00:00')

  const monday = addBusinessDays(friday, 1)

  expect(monday.dayOfWeek).toBe(1)
  expect(monday.day).toBe(20)
})

test('gets week start (Monday)', () => {
  const wednesday = Temporal.PlainDateTime.from('2025-01-15T10:00:00')

  const weekStart = getWeekStart(wednesday)

  expect(weekStart.dayOfWeek).toBe(1)
  expect(weekStart.day).toBe(13)
})

test('gets month start', () => {
  const midMonth = Temporal.PlainDateTime.from('2025-01-15T10:00:00')

  const monthStart = getMonthStart(midMonth)

  expect(monthStart.day).toBe(1)
  expect(monthStart.month).toBe(1)
})

test('checks if date is today', () => {
  const now = Temporal.Now.plainDateTimeISO()
  const yesterday = now.subtract({ days: 1 })
  const tomorrow = now.add({ days: 1 })

  expect(isToday(now)).toBe(true)
  expect(isToday(yesterday)).toBe(false)
  expect(isToday(tomorrow)).toBe(false)
})

test('checks if two dates are the same day', () => {
  const date1 = Temporal.PlainDateTime.from('2025-01-15T10:00:00')
  const date2 = Temporal.PlainDateTime.from('2025-01-15T18:00:00')
  const date3 = Temporal.PlainDateTime.from('2025-01-16T10:00:00')

  expect(isSameDay(date1, date2)).toBe(true)
  expect(isSameDay(date1, date3)).toBe(false)
})
