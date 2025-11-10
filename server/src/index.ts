import type { MaaManager } from './MaaManager'
import type { TaskData } from './Task'
import type { ScheduleData } from './TaskSchedule'

import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator'
import { ORPCError, os, createRouterClient } from '@orpc/server'
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

/**
 * MAA authentication middleware - extracts auth from body for POST or query for GET
 */
const maaAuthMiddleware = base.middleware(async ({ context, next }) => {
  // For MAA endpoints, auth comes from either body (POST) or query params (GET)
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
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Unauthorized device',
    })
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

const maaProtectedProcedure = base.use(maaAuthMiddleware)

const protectedProcedure = base.use(authMiddleware)

/**
 * MAA Remote Control Protocol router
 */
const maaRouter = {
  getTask: maaProtectedProcedure.input(deviceSchema).handler(({ context: { manager } }) => {
    const tasks = manager.getTask()
    logger.debug('Providing tasks to MAA client:', tasks)
    return { tasks }
  }),

  reportStatus: maaProtectedProcedure
    .input(reportSchema)
    .handler(({ context: { manager }, input }) => {
      logger.debug('Reporting task status:', input.task, input.status, input.payload?.slice(0, 30))
      const task = manager.reportStatus(input)
      if (task) return 'success'
      throw new ORPCError('NOT_FOUND', { message: 'task not found' })
    }),

  deviceLog: maaProtectedProcedure.input(z.string()).handler(({ context: { manager }, input }) => {
    logger.debug('Received MAA Log:', input.slice(0, 100))
    manager.deviceLog(input)
    return { success: true }
  }),

  screenshotJpg: maaProtectedProcedure.handler(({ context: { manager } }) =>
    manager.getScreenshotJPEG(),
  ),

  screenshotMjpeg: maaProtectedProcedure.handler(({ context: { manager } }) =>
    // This returns a streaming response, handle specially
    manager.streamResponse(),
  ),

  lock: maaProtectedProcedure.handler(async ({ context: { manager } }) => {
    const result = await manager.lock()
    return result.message
  }),

  unlock: maaProtectedProcedure
    .input(z.object({ delay: z.number().optional().default(10) }))
    .handler(({ context: { manager }, input }) => manager.scheduleUnlock({ minutes: input.delay })),
}

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

  // MAA Remote Control Protocol router
  maa: maaRouter,
}

/**
 * Export type for use in client
 */
export type ORPCRouter = typeof router

// Create server-side client for MAA procedures (for internal use)
const maaClient = createRouterClient(router.maa)

export const app = new Hono<{ Variables: VariablesContext }>().use(compress())

// Setup oRPC handler for main API
const rpcHandler = new RPCHandler(router, {
  interceptors: [],
})

// Mount oRPC handler for main API
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

// MAA remote control protocol endpoints using oRPC procedures internally
// POST endpoints receive auth via JSON body
app.post('/maa/getTask', zValidator('json', deviceSchema), async (c) => {
  try {
    const { device, user } = c.req.valid('json')
    // Call oRPC procedure using server-side client
    const result = await maaClient.getTask(
      { device, user },
      { context: { userId: user, deviceId: device } },
    )
    return c.json(result)
  } catch (error) {
    if (error instanceof ORPCError) {
      return c.json({ error: error.message }, (error.status || 500) as 500)
    }
    logger.error('Failed to get tasks:', error)
    return c.json({ tasks: [] }, 500)
  }
})

app.post('/maa/reportStatus', zValidator('json', reportSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    // Call oRPC procedure using server-side client
    const result = await maaClient.reportStatus(data, {
      context: { userId: data.user, deviceId: data.device },
    })
    return c.text(result)
  } catch (error) {
    if (error instanceof ORPCError) {
      if (error.code === 'NOT_FOUND') return c.text('task not found', 404)
      if (error.code === 'UNAUTHORIZED') return c.text('unauthorized', 401)
    }
    logger.error('Failed to report task status:', error)
    return c.text('internal server error', 500)
  }
})

app.post('/maa/deviceLog', async (c) => {
  const text = await c.req.text()
  try {
    const { device, user } = JSON.parse(text) as { device: string; user: string }
    // Call oRPC procedure using server-side client
    const result = await maaClient.deviceLog(text, { context: { userId: user, deviceId: device } })
    return c.json(result)
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }
    logger.error(`Failed to report MAA Log:`, error)
    return c.json({ success: false, error: JSON.stringify(error) }, 500)
  }
})

// Screenshot endpoints - require auth query params
app.get('/maa/screenshot.jpg', async (c) => {
  const { device, user } = c.req.query()
  if (!device || !user) {
    return c.text('Unauthorized', 401)
  }

  try {
    // Call oRPC procedure using server-side client
    const image = await maaClient.screenshotJpg(undefined, {
      context: { userId: user, deviceId: device },
    })
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': image.length.toString(),
    })
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      return c.text('Unauthorized', 401)
    }
    logger.error('Screenshot error:', error)
    return c.text('Internal Server Error', 500)
  }
})

app.get('/maa/screenshot.mjpeg', async (c) => {
  const { device, user } = c.req.query()
  if (!device || !user) {
    return c.text('Unauthorized', 401)
  }

  try {
    // This endpoint returns a streaming response - handle specially
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
app.get('/maa/lock', async (c) => {
  const { device, user } = c.req.query()
  if (!device || !user) {
    return c.text('Unauthorized', 401)
  }

  try {
    // Call oRPC procedure using server-side client
    const result = await maaClient.lock(undefined, { context: { userId: user, deviceId: device } })
    return c.text(result)
  } catch (error) {
    if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
      return c.text('Unauthorized', 401)
    }
    logger.error('Lock error:', error)
    return c.text('Internal Server Error', 500)
  }
})

app.get(
  '/maa/unlock',
  zValidator('query', z.object({ delay: z.number().optional().default(10) })),
  async (c) => {
    const { device, user } = c.req.query()
    if (!device || !user) {
      return c.text('Unauthorized', 401)
    }

    try {
      const { delay } = c.req.valid('query')
      // Call oRPC procedure using server-side client
      const result = await maaClient.unlock(
        { delay },
        { context: { userId: user, deviceId: device } },
      )
      return c.text(result)
    } catch (error) {
      if (error instanceof ORPCError && error.code === 'UNAUTHORIZED') {
        return c.text('Unauthorized', 401)
      }
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

export * from './lib/schema'

// Re-export RouterClient type for client-side usage
export type { RouterClient } from '@orpc/server'

export default app
export type { ScheduleData, TaskData }
