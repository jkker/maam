import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'

import {
  MAA_REPORT_STATUS_RESPONSE,
  validateGetTaskRequest,
  validateReportStatusRequest,
} from '../shared/protocol/maa'
import { createDashboardRouter } from '../shared/rpc/dashboard'
import { getActor, validateApiAuth, validateMaaAuth } from './auth'
import type { Env } from './env'
import { createInstanceApi } from './instance-api'

const dashboardHandler = new RPCHandler(createDashboardRouter())

export const app = new Hono<{ Bindings: Env }>()

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.use('/rpc/*', async (c, next) => {
  if (!validateApiAuth(c.req.raw, c.env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { matched, response } = await dashboardHandler.handle(c.req.raw, {
    context: {
      actor: getActor(c.req.raw),
      api: createInstanceApi(c.env),
    },
    prefix: '/rpc',
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }

  await next()
})

app.use('/maa/*', async (c, next) => {
  if (!validateMaaAuth(c.req.raw, c.env)) {
    return c.text('Unauthorized', 401)
  }

  await next()
})

app.post('/maa/getTask', async (c) => {
  const body = validateGetTaskRequest(await c.req.json().catch(() => null))
  if (!body) {
    return c.json({ tasks: [] })
  }

  return c.json(await createInstanceApi(c.env).getTask(body.user, body.device))
})

app.post('/maa/reportStatus', async (c) => {
  const body = validateReportStatusRequest(await c.req.json().catch(() => null))
  if (!body) {
    return c.text(MAA_REPORT_STATUS_RESPONSE)
  }

  return c.text(
    await createInstanceApi(c.env).reportStatus(
      body.user,
      body.device,
      body.task,
      body.status,
      body.payload,
    ),
  )
})

app.post('/maa/deviceLog', async (c) => {
  const user = c.req.query('user') ?? c.req.header('x-maam-user')
  const device = c.req.query('device') ?? c.req.header('x-maam-device')
  if (!user || !device) {
    return c.json({ success: false })
  }

  return c.json(await createInstanceApi(c.env).deviceLog(user, device, await c.req.text()))
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))
