import type { TaskData } from './Task'
import type { ScheduleData } from './TaskSchedule'

import { serveStatic } from '@hono/node-server/serve-static'
import { trpcServer } from '@hono/trpc-server'
import { zValidator } from '@hono/zod-validator'
import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { logger as loggerMiddleware } from 'hono/logger'
import { z } from 'zod'

import { DEFAULT_USER, DEFAULT_DEVICE, TASK_TYPE, MJPEG_BOUNDARY } from './const'
import { initDatabase } from './lib/db'
import { DEBUG, logger } from './lib/logger'
import { fetchUpcomingEvents } from './lib/prts.wiki'
import { reportSchema, scheduleSchema } from './lib/schema'
import { MaaManager } from './MaaManager'
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
  // Lock control procedures
  locked: t.procedure.query(({ ctx: { manager } }) => manager.locked),
  toggleLock: t.procedure
    .input(z.boolean())
    .mutation(async ({ ctx: { manager }, input }) => (input ? manager.lock() : manager.unlock())),

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
  // Screenshot endpoints
  .get('/maa/screenshot.jpg', async (c) => {
    const image = await manager.getScreenshotJPEG()
    return c.body(image, 200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': image.length.toString(),
    })
  })
  // MJPEG screenshot stream endpoint
  .get('/maa/screenshot.mjpeg', (c) =>
    c.body(manager.createStream(), 200, {
      'Content-Type': `multipart/x-mixed-replace;boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }),
  )
  // management endpoints
  .get('/maa/lock', async (c) => c.text((await manager.lock()).message))
  .get(
    '/maa/unlock',
    zValidator('query', z.object({ delay: z.number().optional().default(10) })),
    (c) => c.text(manager.scheduleUnlock({ minutes: c.req.valid('query').delay })),
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
