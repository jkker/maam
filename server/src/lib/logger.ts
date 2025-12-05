import { createStream } from 'rotating-file-stream'
import { Logger } from 'tslog'

/** Parse boolean from environment variable - accepts 'true', '1', 'yes' (case insensitive) */
function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export const DEBUG = parseBoolEnv(process.env.DEBUG, false)
export const logger = new Logger({
  minLevel: DEBUG ? 0 : 3, // Info and above
  hideLogPositionForProduction: !DEBUG,
})
if (DEBUG) logger.debug('Debug logging enabled')

const stream = createStream('../maam.jsonl', {
  size: '100M', // rotate every 100 MegaBytes written
  interval: '30d', // rotate every 30 days
})
logger.attachTransport((logObj) => stream.write(JSON.stringify(logObj) + '\n'))
