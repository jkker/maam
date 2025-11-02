import { serveStatic } from '@hono/node-server/serve-static'
import { trpcServer } from '@hono/trpc-server'
import { zValidator } from '@hono/zod-validator'
import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger as loggerMiddleware } from 'hono/logger'
import { mimes } from 'hono/utils/mime'
import { z } from 'zod'

import { DEFAULT_USER, DEFAULT_DEVICE, TASK_TYPE } from './const'
import { initDatabase } from './lib/db'
import { DEBUG, logger } from './lib/logger'
import { fetchUpcomingEvents } from './lib/prts.wiki'
import { reportSchema, scheduleSchema } from './lib/schema'
import { MaaManager, MJPEG_BOUNDARY, type ScheduleData, type TaskData } from './MaaManager'
// Initialize database
initDatabase()

interface VariablesContext {
  manager: MaaManager
}

export const manager = new MaaManager(DEFAULT_DEVICE, DEFAULT_USER)

const t = initTRPC.context<VariablesContext>().create({ sse: { ping: { enabled: false } } })

/**
 * Main application router combining all sub-routers
 */
export const router = t.router({
  // Manager control procedures
  start: t.procedure.mutation(async ({ ctx: { manager } }) => manager.start()),
  stop: t.procedure.mutation(async ({ ctx: { manager } }) => manager.stop()),
  locked: t.procedure.query(({ ctx: { manager } }) => manager.locked),
  toggleLock: t.procedure
    .input(z.boolean())
    .mutation(async ({ ctx: { manager }, input }) => (input ? manager.lock() : manager.unlock())),

  // Schedule management procedures
  schedules: t.procedure.query(({ ctx: { manager } }) => manager.schedules.map((s) => s.data)),
  addSchedule: t.procedure.input(scheduleSchema).mutation(({ ctx: { manager }, input }) => {
    const schedule = manager.addSchedule(input)
    return { success: true, message: 'Schedule created', schedule }
  }),
  removeSchedule: t.procedure
    .input(z.string())
    .mutation(({ ctx: { manager }, input }) => manager.removeSchedule(input)),
  schedule: {
    get: t.procedure.query(({ ctx: { manager } }) => manager.schedules.map((s) => s.data)),
    add: t.procedure
      .input(scheduleSchema)
      .mutation(({ ctx: { manager }, input }) => manager.addSchedule(input)),
    remove: t.procedure
      .input(z.string())
      .mutation(({ ctx: { manager }, input }) => manager.removeSchedule(input)),
  },

  /**
   * Dispatch a custom task
   */
  dispatch: t.procedure
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
  tasks: t.procedure.subscription(({ ctx, signal }) => ctx.manager.listen('update', { signal })),
  runningTask: t.procedure.query(({ ctx: { manager } }) => manager.getRunningTask()),

  screenshotQuery: t.procedure.query(async ({ ctx }) => {
    const { payload } = await ctx.manager.create('CaptureImageNow').waitFor('DONE')
    if (!payload) throw new Error('Failed to capture screenshot')
    return payload
  }),

  deviceLog: t.procedure.subscription(async function* ({ ctx, signal }) {
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
  .use('/trpc/*', trpcServer({ router, createContext: () => ({ manager }) }))
  // MJPEG screenshot stream endpoint
  .get('/screenshot-stream', (c) => {
    logger.info('New MJPEG stream connection')

    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

    const stream = new ReadableStream({
      start(controller) {
        // Store reference for cleanup
        streamController = controller

        // Register this controller with the manager
        manager.addStreamController(controller)

        // Send initial boundary
        const initialBoundary = new TextEncoder().encode(`${MJPEG_BOUNDARY}\r\n`)
        controller.enqueue(initialBoundary)
      },
      cancel() {
        logger.info('MJPEG stream connection closed')
        // Properly clean up the controller
        if (streamController) {
          manager.removeStreamController(streamController)
          streamController = null
        }
      },
    })

    return c.body(stream, 200, {
      'Content-Type': `multipart/x-mixed-replace;boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
  })
  // MAA remote control protocol endpoints
  // https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html#获取任务端点
  .post('/maa/getTask', (c) => {
    try {
      const tasks = manager.getTask()
      logger.debug('Providing tasks to MAA client:', tasks)
      return c.json({ tasks })
    } catch (error) {
      logger.error('Failed to get tasks:', error)
      return c.json({ tasks: [] }, 500)
    }
  })
  // https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html#汇报任务端点
  .post('/maa/reportStatus', zValidator('json', reportSchema), (c) => {
    try {
      const data = c.req.valid('json')
      logger.debug('Reporting task status:', data.task, data.status, data.payload?.slice(0, 30))
      const task = manager.reportStatus(data)
      if (task) return c.text('success')
    } catch (error) {
      logger.error('Failed to report task status:', error)
      return c.text('internal server error', 500)
    }
    return c.text('task not found', 404)
  })
  // https://github.com/MaaAssistantArknights/MaaAssistantArknights/blob/dev/src/MaaWpfGui/Services/Notification/ExternalNotificationService.cs
  .post('/maa/deviceLog', async (c) => {
    const text = await c.req.text()
    logger.debug('Received MAA Log:', text.slice(0, 100))
    try {
      manager.deviceLog(text)
      return c.json({ success: true })
    } catch (error) {
      logger.error(`Failed to report MAA Log:\n`, error)
      return c.json({ success: false, error: JSON.stringify(error) }, 500)
    }
  })
  // task control endpoints
  .get('/maa/screenshot', async (c) => {
    const { id, payload } = await manager.create('CaptureImageNow').waitFor('DONE')
    if (!payload) return c.json({ error: 'Failed to capture screenshot' }, 500)

    const image = Buffer.from(payload, 'base64')
    manager.tasks.delete(id)
    return c.body(image, 200, {
      'Content-Type': mimes.png,
      'Content-Length': image.length.toString(),
    })
  })
  // management endpoints
  .get('/maa/lock', async (c) => c.text((await manager.lock()).message))
  .get('/maa/unlock', (c) => {
    // Parse delay parameter (in minutes), default to 10 minutes
    const delayMinutes = Number(c.req.query('delay')) || 10
    const delay = { minutes: delayMinutes }

    if (manager.locked) {
      const { scheduledFor, delayDuration } = manager.scheduleUnlock(delay)
      const { hours, minutes } = delayDuration
      let message = `MAA将在`
      if (hours > 0) message += `${hours}小时`
      if (minutes > 0) message += `${minutes}分钟`
      message += `后出笼（${scheduledFor.toPlainTime().toString({ smallestUnit: 'minute' })}）。`
      return c.text(message)
    } else {
      return c.text('MAA已经在外面溜达了。')
    }
  })

// In development, redirect all other routes to the Vite dev server
if (import.meta.env.DEV) app.get('*', (c) => c.redirect('http://localhost:3113'))
// In production, serve static files from the public directory
else app.use(serveStatic({ root: 'dist/public', index: 'index.html' }))

// Apply logging middleware in debug mode
if (DEBUG) app.use(loggerMiddleware())

export * from './lib/schema'

export default app
export type { ScheduleData, TaskData }
