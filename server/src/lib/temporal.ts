import 'temporal-polyfill/global'

export const getNow = () => Temporal.Now.instant().toZonedDateTimeISO(Temporal.Now.timeZoneId())
