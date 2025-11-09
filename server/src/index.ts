import type { TaskData } from './Task'
import type { ScheduleData } from './TaskSchedule'
import type { MaaManager } from './MaaManager'

import { serveStatic } from '@hono/node-server/serve-static'
import { trpcServer } from '@hono/trpc-server'
import { zValidator } from '@hono/zod-validator'
import { initTRPC, TRPCError } from '@trpc/server'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger as loggerMiddleware } from 'hono/logger'
import { z } from 'zod'

import { TASK_TYPE, MJPEG_BOUNDARY } from './const'
import { initDatabase } from './lib/db'
import { dbService } from './lib/db/service'
import { DEBUG, logger } from './lib/logger'
import { managerService } from './lib/managers'
import { fetchUpcomingEvents } from './lib/prts.wiki'
import { reportSchema, scheduleSchema, deviceSchema } from './lib/schema'

// Initialize database
initDatabase()

interface VariablesContext {
  manager: MaaManager
  userId: string
  deviceId: string
}

interface AuthContext {
  userId?: string
  deviceId?: string
}

const t = initTRPC.context<AuthContext>().create({ sse: { ping: { enabled: false } } })

/**
 * Authentication middleware for tRPC procedures
 * Extracts device and user from request headers
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  // In tRPC, we'll receive auth from headers or meta
  const userId = ctx.userId
  const deviceId = ctx.deviceId

  if (!userId || !deviceId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
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
    ctx: {
      manager,
      userId,
      deviceId,
    },
  })
})

const protectedProcedure = t.procedure.use(authMiddleware)

/**
 * Main application router combining all sub-routers
 */
export const router = t.router({
  // Authentication procedures
  auth: {
    /**
     * Register or login a user with their device
     */
    login: t.procedure
      .input(
        z.object({
          userId: z.string().min(1),
          deviceId: z.string().min(10),
          deviceName: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          await dbService.getUserOrCreate(input.userId)
          await dbService.getDeviceOrCreate(input.deviceId, input.userId, input.deviceName)
          
          // Pre-warm the manager
          await managerService.getManager(input.deviceId, input.userId)

          return { success: true, userId: input.userId, deviceId: input.deviceId }
        } catch (error) {
          logger.error('Login failed:', error)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to authenticate',
          })
        }
      }),
  },

  // Manager control procedures
  start: protectedProcedure.mutation(async ({ ctx: { manager } }) => manager.start()),
  stop: protectedProcedure.mutation(async ({ ctx: { manager } }) => manager.stop()),
  
  // Lock control procedures
  locked: protectedProcedure.query(({ ctx: { manager } }) => manager.locked),
  toggleLock: protectedProcedure
    .input(z.boolean())
    .mutation(async ({ ctx: { manager }, input }) => (input ? manager.lock() : manager.unlock())),

  schedule: {
    get: protectedProcedure.query(({ ctx: { manager } }) => manager.schedules.map((s) => s.data)),
    add: protectedProcedure
      .input(scheduleSchema)
      .mutation(({ ctx: { manager }, input }) => manager.addSchedule(input)),
    remove: protectedProcedure
      .input(z.string())
      .mutation(({ ctx: { manager }, input }) => manager.removeSchedule(input)),
    postpone: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          until: z.string().optional(),
        }),
      )
      .mutation(({ ctx: { manager }, input }) => manager.postponeSchedule(input.id, input.until)),
    resume: protectedProcedure
      .input(z.string())
      .mutation(({ ctx: { manager }, input }) => manager.resumeSchedule(input)),
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
    .mutation(({ ctx, input }) => {
      const task = ctx.manager.create(input.task, input.params)
      return { success: true, task: task.data }
    }),

  /**
   * Subscription for real-time task updates
   * Emits task data whenever task state changes
   */
  tasks: protectedProcedure.subscription(({ ctx, signal }) =>
    ctx.manager.listen('update', { signal }),
  ),

  deviceLog: protectedProcedure.subscription(async function* ({ ctx, signal }) {
    yield ctx.manager.logs.slice(-50)
    yield* ctx.manager.listen('deviceLog', { signal })
  }),

  eventCalendar: t.procedure.query(async () => fetchUpcomingEvents()),
})

/**
 * Export type for use in client
 */
export type TRPCRouter = typeof router

export const app = new Hono<{ Variables: VariablesContext }>()
  .use(compress())
  .use(
    '/trpc/*',
    trpcServer({
      router,
      createContext: (opts) => {
        // Extract auth from headers
        const userId = opts.req.raw.headers.get('x-user-id') || undefined
        const deviceId = opts.req.raw.headers.get('x-device-id') || undefined
        return { userId, deviceId }
      },
    }),
  )

  // MAA remote control protocol endpoints
  // These require device+user authentication
  .post(
    '/maa/getTask',
    zValidator('json', deviceSchema),
    async (c) => {
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
    },
  )

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

  .post('/maa/deviceLog', zValidator('json', deviceSchema), async (c) => {
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

  // Screenshot endpoints - require auth headers
  .get('/maa/screenshot.jpg', async (c) => {
    const deviceId = c.req.header('x-device-id')
    const userId = c.req.header('x-user-id')

    if (!deviceId || !userId) {
      return c.text('Unauthorized', 401)
    }

    const isValid = await dbService.validateDeviceOwnership(deviceId, userId)
    if (!isValid) {
      return c.text('Unauthorized', 401)
    }

    const manager = await managerService.getManager(deviceId, userId)
    const image = await manager.getScreenshotJPEG()
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': image.length.toString(),
    })
  })

  .get('/maa/screenshot.mjpeg', async (c) => {
    const deviceId = c.req.header('x-device-id')
    const userId = c.req.header('x-user-id')

    if (!deviceId || !userId) {
      return c.text('Unauthorized', 401)
    }

    const isValid = await dbService.validateDeviceOwnership(deviceId, userId)
    if (!isValid) {
      return c.text('Unauthorized', 401)
    }

    const manager = await managerService.getManager(deviceId, userId)
    return c.body(manager.createStream(), 200, {
      'Content-Type': `multipart/x-mixed-replace;boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
  })

  // Management endpoints - require auth headers
  .get('/maa/lock', async (c) => {
    const deviceId = c.req.header('x-device-id')
    const userId = c.req.header('x-user-id')

    if (!deviceId || !userId) {
      return c.text('Unauthorized', 401)
    }

    const isValid = await dbService.validateDeviceOwnership(deviceId, userId)
    if (!isValid) {
      return c.text('Unauthorized', 401)
    }

    const manager = await managerService.getManager(deviceId, userId)
    return c.text((await manager.lock()).message)
  })

  .get(
    '/maa/unlock',
    zValidator('query', z.object({ delay: z.number().optional().default(10) })),
    async (c) => {
      const deviceId = c.req.header('x-device-id')
      const userId = c.req.header('x-user-id')

      if (!deviceId || !userId) {
        return c.text('Unauthorized', 401)
      }

      const isValid = await dbService.validateDeviceOwnership(deviceId, userId)
      if (!isValid) {
        return c.text('Unauthorized', 401)
      }

      const manager = await managerService.getManager(deviceId, userId)
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
