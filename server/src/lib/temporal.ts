import 'temporal-polyfill/global'

export const getNow = (tz = Temporal.Now.timeZoneId()) =>
  Temporal.Now.instant().toZonedDateTimeISO(tz)
