import type { RequestHeadersPluginContext } from '@orpc/server/plugins'

import type { MaaManager } from './MaaManager'
import type { TaskData } from './Task'
import type { ScheduleData } from './TaskSchedule'

import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator'
import { ORPCError, os, type RouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { RequestHeadersPlugin } from '@orpc/server/plugins'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger as loggerMiddleware } from 'hono/logger'
import { z } from 'zod'

import { TASK_TYPE } from './const'
import * as dbService from './lib/db/service'
import { DEBUG, logger } from './lib/logger'
import { managerService } from './lib/managers'
import { fetchUpcomingEvents } from './lib/prts.wiki'
import { reportSchema, scheduleSchema, deviceSchema } from './lib/schema'

interface VariablesContext {
  manager: MaaManager
  user: string
  device: string
}

/**
 * Auth context with request headers support
 */
interface AuthContext extends RequestHeadersPluginContext {
  user?: string
  device?: string
  manager?: MaaManager
}

/**
 * Base oRPC procedure with request headers plugin context
 */
const base = os.$context<AuthContext>()

/**
 * Authentication middleware for oRPC procedures
 * Extracts device and user from HTTP headers (x-maam-user, x-maam-device)
 * Performs handshake validation by sending heartbeat and verifying response
 */
const authMiddleware = base.middleware(async ({ context, next }) => {
  // Extract auth from HTTP headers (OpenAPI 3.x compliant)
  const user = context.reqHeaders?.get('x-maam-user')
  const device = context.reqHeaders?.get('x-maam-device')

  if (!user || !device) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Missing authentication credentials in headers',
    })
  }

  // Validate device ownership
  const isValid = await dbService.validateDeviceOwnership(device, user)

  if (!isValid) {
    // First-time authentication - create user and device
    await dbService.getUserOrCreate(user)
    await dbService.getDeviceOrCreate(device, user)
  }

  // Get manager for this user+device
  const manager = await managerService.getManager(device, user)

  // Perform handshake validation only for new authentications
  // Skip handshake for existing valid devices to avoid breaking existing workflows
  if (!isValid) {
    try {
      // First-time authentication - verify device is online with heartbeat
      const heartbeatTask = manager.create('HeartBeat')
      await heartbeatTask.waitFor('RUNNING', { seconds: 5 })

      // Wait for device to report back
      await heartbeatTask.waitFor('DONE', { seconds: 10 })

      // First successful handshake - create default schedules
      logger.info(`First successful auth for ${user}@${device}, creating default schedules`)

      // Create default schedules for LinkStart at 04:00, 12:00, and 20:00
      // Use system timezone (each schedule can specify timezone if needed)
      const defaultHours = [4, 12, 20]
      for (const hour of defaultHours) {
        manager.addSchedule({
          task: 'LinkStart',
          hour,
          minute: 0,
        })
      }
    } catch (error) {
      logger.error('Handshake validation failed:', error)
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Device handshake failed - device may be offline or credentials mismatch',
        cause: error,
      })
    }
  }

  return next({ context: { manager, user, device } })
})

const protectedProcedure = base.use(authMiddleware)

/**
 * Main application router combining all procedures
 */
export const router = {
  // Authentication procedures
  auth: {
    /**
     * Register or login a user with their device
     * Does NOT perform handshake - just creates/validates credentials
     */
    login: base
      .input(
        z.object({
          user: z.string().min(1),
          device: z.string().min(10),
          label: z.string().optional(),
        }),
      )
      .handler(async ({ input }) => {
        try {
          await dbService.getUserOrCreate(input.user)
          await dbService.getDeviceOrCreate(input.device, input.user, input.label)

          // Pre-warm the manager
          await managerService.getManager(input.device, input.user)

          return { success: true, user: input.user, device: input.device }
        } catch (error) {
          logger.error('Login failed:', error)
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: 'Failed to authenticate',
          })
        }
      }),

    /**
     * Test heartbeat to verify device is online
     * This triggers handshake validation
     */
    heartbeat: protectedProcedure.handler(({ context: { manager } }) => {
      return { online: true, device: manager.device, user: manager.user }
    }),
  },

  // Manager control procedures
  start: protectedProcedure.handler(async ({ context: { manager } }) => manager.start()),
  stop: protectedProcedure.handler(async ({ context: { manager } }) => manager.stop()),

  // Lock control procedures
  locked: protectedProcedure.handler(({ context: { manager } }) => manager.locked),
  toggleLock: protectedProcedure
    .input(z.boolean())
    .handler(async ({ context: { manager }, input }) =>
      input ? manager.lock() : manager.unlock(),
    ),

  schedule: {
    get: protectedProcedure.handler(({ context: { manager } }) =>
      manager.schedules.map((s) => s.data),
    ),
    add: protectedProcedure
      .input(scheduleSchema)
      .handler(({ context: { manager }, input }) => manager.addSchedule(input)),
    remove: protectedProcedure
      .input(z.string())
      .handler(({ context: { manager }, input }) => manager.removeSchedule(input)),
    postpone: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          until: z.string().optional(),
        }),
      )
      .handler(({ context: { manager }, input }) =>
        manager.postponeSchedule(input.id, input.until),
      ),
    resume: protectedProcedure
      .input(z.string())
      .handler(({ context: { manager }, input }) => manager.resumeSchedule(input)),
  },

  /**
   * Dispatch a custom task
   */
  dispatch: protectedProcedure
    .input(
      z.object({
        task: z.enum(TASK_TYPE),
        params: z.string().optional(),
      }),
    )
    .handler(({ context, input }) => {
      const task = context.manager.create(input.task, input.params)
      return { success: true, task: task.data }
    }),

  /**
   * Subscription for real-time task updates
   * Emits task data whenever task state changes
   */
  tasks: protectedProcedure.handler(async function* ({ context, signal }) {
    yield* context.manager.listen('update', { signal })
  }),

  deviceLog: protectedProcedure.handler(async function* ({ context, signal }) {
    yield context.manager.logs.slice(-50)
    yield* context.manager.listen('deviceLog', { signal })
  }),

  eventCalendar: base.handler(async () => fetchUpcomingEvents()),
}

export type ORPC = RouterClient<typeof router>
const handler = new RPCHandler(router, { plugins: [new RequestHeadersPlugin()] })

export const app = new Hono<{ Variables: VariablesContext }>()
  .use(compress())
  // Mount oRPC handler for main API
  .use('/rpc/*', async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: '/rpc',
      context: {}, // Context populated by RequestHeadersPlugin
    })
    if (matched) return c.newResponse(response.body, response)

    await next()
  })

  // MAA remote control protocol endpoints using plain Hono with custom middleware
  // POST endpoints (getTask, reportStatus) receive auth via JSON body
  // Other endpoints (deviceLog, lock, unlock, screenshot) receive auth via URL params
  .post('/maa/getTask', zValidator('json', deviceSchema), async (c) => {
    try {
      const { device, user } = c.req.valid('json')

      // Validate and get manager
      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const manager = await managerService.getManager(device, user)
      const tasks = manager.getTask()
      logger.debug('Providing tasks to MAA client:', tasks)
      return c.json({ tasks })
    } catch (error) {
      logger.error('Failed to get tasks:', error)
      return c.json({ tasks: [] }, 500)
    }
  })

  .post('/maa/reportStatus', zValidator('json', reportSchema), async (c) => {
    try {
      const data = c.req.valid('json')
      logger.debug('Reporting task status:', data.task, data.status, data.payload?.slice(0, 30))

      // Validate and get manager
      const isValid = await dbService.validateDeviceOwnership(data.device, data.user)
      if (!isValid) {
        return c.text('unauthorized', 401)
      }

      const manager = await managerService.getManager(data.device, data.user)
      const task = manager.reportStatus(data)
      if (task) return c.text('success')
    } catch (error) {
      logger.error('Failed to report task status:', error)
      return c.text('internal server error', 500)
    }
    return c.text('task not found', 404)
  })

  .post('/maa/deviceLog', async (c) => {
    const text = await c.req.text()
    logger.debug('Received MAA Log:', text.slice(0, 100))
    try {
      const { device, user } = JSON.parse(text) as { device: string; user: string }

      // Validate and get manager
      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) {
        return c.json({ success: false, error: 'Unauthorized' }, 401)
      }

      const manager = await managerService.getManager(device, user)
      manager.deviceLog(text)
      return c.json({ success: true })
    } catch (error) {
      logger.error(`Failed to report MAA Log:`, error)
      return c.json({ success: false, error: JSON.stringify(error) }, 500)
    }
  })

  // Screenshot endpoints - require auth query params
  .get('/maa/screenshot.jpg', async (c) => {
    const { device, user } = c.req.query()

    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

    try {
      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) {
        return c.text('Unauthorized', 401)
      }

      const manager = await managerService.getManager(device, user)
      const image = await manager.getScreenshotJPEG()
      return c.body(image, 200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': image.length.toString(),
      })
    } catch (error) {
      logger.error('Screenshot error:', error)
      return c.text('Internal Server Error', 500)
    }
  })

  .get('/maa/screenshot.mjpeg', async (c) => {
    const { device, user } = c.req.query()

    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

    try {
      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) return c.text('Unauthorized', 401)

      const manager = await managerService.getManager(device, user)
      return manager.streamResponse()
    } catch (error) {
      logger.error('Screenshot stream error:', error)
      return c.text('Internal Server Error', 500)
    }
  })

  // Management endpoints - require auth query params
  .get('/maa/lock', async (c) => {
    const { device, user } = c.req.query()

    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

    try {
      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) {
        return c.text('Unauthorized', 401)
      }

      const manager = await managerService.getManager(device, user)
      return c.text((await manager.lock()).message)
    } catch (error) {
      logger.error('Lock error:', error)
      return c.text('Internal Server Error', 500)
    }
  })

  .get(
    '/maa/unlock',
    zValidator('query', z.object({ delay: z.number().optional().default(10) })),
    async (c) => {
      const { device, user } = c.req.query()

      if (!device || !user) {
        return c.text('Unauthorized', 401)
      }

      try {
        const isValid = await dbService.validateDeviceOwnership(device, user)
        if (!isValid) {
          return c.text('Unauthorized', 401)
        }

        const { delay } = c.req.valid('query')
        const manager = await managerService.getManager(device, user)
        return c.text(manager.scheduleUnlock({ minutes: delay }))
      } catch (error) {
        logger.error('Unlock error:', error)
        return c.text('Internal Server Error', 500)
      }
    },
  )

// In development, redirect all other routes to the Vite dev server
if (import.meta.env.DEV) app.get('*', (c) => c.redirect('http://localhost:3113'))
// In production, serve static files from the public directory
else app.use(serveStatic({ root: 'dist/public', index: 'index.html' }))

// Apply logging middleware in debug mode
if (DEBUG) app.use(loggerMiddleware())

export default app
export type { ScheduleData, TaskData }
