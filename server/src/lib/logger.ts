import arkenv from 'arkenv'
import { createStream } from 'rotating-file-stream'
import { Logger } from 'tslog'

/**
 * Environment configuration using arkenv (ArkType-based env parsing)
 * Single source of truth for environment variables
 */
const env = arkenv({
  // Parse DEBUG as string with explicit false default
  DEBUG: "'true' | 'false' | '1' | '0' = 'false'",
})

export const DEBUG = env.DEBUG === 'true' || env.DEBUG === '1'

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
