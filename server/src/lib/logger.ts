import { createStream } from 'rotating-file-stream'
import { Logger } from 'tslog'
import * as z from 'zod'
export const DEBUG = z.stringbool().default(false).parse(process.env.DEBUG)
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
