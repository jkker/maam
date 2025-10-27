import * as cheerio from 'cheerio'

import { ARKNIGHTS_TIME_ZONE } from './schema'
import { getNow } from './temporal'

const baseURL = 'https://prts.wiki'
export type PRTSCalendarEvent = { time: string; name: string; href: string }

let cache: PRTSCalendarEvent[] | null = null
let lastFetchTime: number | null = null

export const fetchUpcomingEvents = async (
  duration: Temporal.DurationLike = { years: 1 },
  staleTimeMs: number = 1000 * 60 * 30, // 30 minutes
) => {
  const now = getNow()
  // return cached if within 30 minutes
  if (cache && lastFetchTime && now.epochMilliseconds - lastFetchTime < staleTimeMs) {
    return cache
  }
  const html = await fetch(`${baseURL}/w/活动一览`).then((r) => r.text())
  const $ = cheerio.load(html)

  const rows = $('#toc ~ table.wikitable tr').slice(1) // skip header row

  const events: PRTSCalendarEvent[] = []

  for (const row of rows) {
    const cells = $(row).find('td')
    const timeStr = cells.eq(0).text().trim()
    if (!timeStr) continue

    const link = cells.eq(1).find('a')

    const time = Temporal.PlainDateTime.from(timeStr).toZonedDateTime(ARKNIGHTS_TIME_ZONE)
    // if event time is beyond duration from now, skip
    if (Temporal.Duration.compare(time.since(now).abs(), duration, { relativeTo: now }) > 0)
      continue

    events.push({
      time: time.toString(),
      name: link.text(),
      href: baseURL + link.attr('href') || '',
    })
  }
  cache = events
  lastFetchTime = now.epochMilliseconds
  return events
}
