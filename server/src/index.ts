import type { MaaManager } from './MaaManager'
import type { TaskData } from './Task'
import type { ScheduleData } from './TaskSchedule'

import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator'
import { ORPCError, os } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
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
  userId: string
  deviceId: string
}

interface AuthContext {
  userId?: string
  deviceId?: string
  manager?: MaaManager
}

/**
 * Base oRPC procedure with optional auth context
 */
const base = os.$context<AuthContext>()

/**
 * Authentication middleware for oRPC procedures
 * Extracts device and user from context and validates
 */
const authMiddleware = base.middleware(async ({ context, next }) => {
  const userId = context.userId
  const deviceId = context.deviceId

  if (!userId || !deviceId) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Missing authentication credentials',
    })
  }

  // Validate device ownership
  const isValid = await dbService.validateDeviceOwnership(deviceId, userId)
  if (!isValid) {
    // Auto-create if not exists
    await dbService.getUserOrCreate(userId)
    await dbService.getDeviceOrCreate(deviceId, userId)
  }

  // Get manager for this user+device
  const manager = await managerService.getManager(deviceId, userId)

  return next({
    context: {
      manager,
      userId,
      deviceId,
    },
  })
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

          return { success: true, userId: input.user, deviceId: input.device }
        } catch (error) {
          logger.error('Login failed:', error)
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: 'Failed to authenticate',
          })
        }
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

/**
 * Export type for use in client
 */
export type ORPCRouter = typeof router

export const app = new Hono<{ Variables: VariablesContext }>().use(compress())

// Setup oRPC handler
const rpcHandler = new RPCHandler(router, {
  interceptors: [],
})

// Mount oRPC handler
app.use('/rpc/*', async (c, next) => {
  // Extract auth from query params
  const userId = c.req.query('user') || undefined
  const deviceId = c.req.query('device') || undefined

  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context: { userId, deviceId }, // Provide initial context
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }

  await next()
})

// MAA remote control protocol endpoints
// These require device+user authentication
app.post('/maa/getTask', zValidator('json', deviceSchema), async (c) => {
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

app.post('/maa/reportStatus', zValidator('json', reportSchema), async (c) => {
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

app.post('/maa/deviceLog', zValidator('json', deviceSchema), async (c) => {
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
      logger.error(`Failed to report MAA Log:\n`, error)
      return c.json({ success: false, error: JSON.stringify(error) }, 500)
    }
  })

  // Screenshot endpoints - require auth query params
app.get('/maa/screenshot.jpg', async (c) => {
    const { device, user } = c.req.query()

    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

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
  })

app.get('/maa/screenshot.mjpeg', async (c) => {
    const { device, user } = c.req.query()

    const isValid = await dbService.validateDeviceOwnership(device, user)

    if (!isValid) return c.text('Unauthorized', 401)

    const manager = await managerService.getManager(device, user)
    return manager.streamResponse()
  })

  // Management endpoints - require auth query params
app.get('/maa/lock', async (c) => {
    const { device, user } = c.req.query()

    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

    const isValid = await dbService.validateDeviceOwnership(device, user)
    if (!isValid) {
      return c.text('Unauthorized', 401)
    }

    const manager = await managerService.getManager(device, user)
    return c.text((await manager.lock()).message)
  })

app.get(
    '/maa/unlock',
    zValidator('query', z.object({ delay: z.number().optional().default(10) })),
    async (c) => {
      const { device, user } = c.req.query()

      if (!device || !user) {
        return c.text('Unauthorized', 401)
      }

      const isValid = await dbService.validateDeviceOwnership(device, user)
      if (!isValid) {
        return c.text('Unauthorized', 401)
      }

      const manager = await managerService.getManager(device, user)
      return c.text(manager.scheduleUnlock({ minutes: c.req.valid('query').delay }))
    },
  )

// In development, redirect all other routes to the Vite dev server
if (import.meta.env.DEV) app.get('*', (c) => c.redirect('http://localhost:3113'))
// In production, serve static files from the public directory
else app.use(serveStatic({ root: 'dist/public', index: 'index.html' }))

// Apply logging middleware in debug mode
if (DEBUG) app.use(loggerMiddleware())

export * from './lib/schema'

export default app
export type { ScheduleData, TaskData }
