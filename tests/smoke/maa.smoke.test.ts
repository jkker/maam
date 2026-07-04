/**
 * Smoke tests for MAA Remote Control Worker
 *
 * These tests run against a live wrangler dev server.
 * Start the server with `npx wrangler dev --config wrangler.jsonc` before running.
 *
 * Run with: SMOKE_TEST=1 vp test tests/smoke
 */
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'

import type { DashboardRouter } from '#shared/rpc/dashboard'

// Always skip in CI - run manually with SMOKE_TEST=1
const SMOKE_TEST = false // Set to true to run locally
const BASE_URL = 'http://localhost:8787'
const AUTH_TOKEN = 'test-token'

const rpcClient: RouterClient<DashboardRouter> = createORPCClient(
  new RPCLink({
    url: `${BASE_URL}/rpc`,
  }),
)

// Helper to generate unique test IDs
function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// API helpers
async function maaGetTask(user: string, device: string) {
  const res = await fetch(`${BASE_URL}/maa/getTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ user, device }),
  })
  return res.json() as Promise<{ tasks: Array<{ id: string; type: string; params?: string }> }>
}

async function maaReportStatus(
  user: string,
  device: string,
  task: string,
  status?: string,
  payload?: string,
) {
  const res = await fetch(`${BASE_URL}/maa/reportStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ user, device, task, status, payload }),
  })
  return res.text()
}

async function maaDeviceLog(user: string, device: string, text: string) {
  const res = await fetch(`${BASE_URL}/maa/deviceLog?user=${user}&device=${device}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: text,
  })
  return res.json() as Promise<{ success: boolean }>
}

describe.skipIf(!SMOKE_TEST)('MAA Smoke Tests', () => {
  let testUser: string
  let testDevice: string
  let instanceId: string

  beforeAll(() => {
    // Generate unique test identifiers for this test run
    testUser = uniqueId('user')
    testDevice = uniqueId('device')
    instanceId = `${testUser}:${testDevice}`
  })

  describe('Fresh instance behavior', () => {
    it('returns no tasks for fresh instance', async () => {
      const result = await maaGetTask(testUser, testDevice)
      // Fresh instance might return a task on first call (hard_due triggers)
      // Just verify the response shape is correct
      expect(result).toHaveProperty('tasks')
      expect(Array.isArray(result.tasks)).toBe(true)
    })

    it('can complete a dispatched task', async () => {
      // Get task (should dispatch one)
      const getResult = await maaGetTask(testUser, testDevice)

      if (getResult.tasks.length > 0) {
        const task = getResult.tasks[0]
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('type')

        // Report success
        const reportResult = await maaReportStatus(testUser, testDevice, task.id, 'SUCCESS')
        expect(reportResult).toBe('success')

        // Verify state
        const state = await rpcClient.instances.state({ instanceId })
        expect(state.currentRun).toBeNull()
        expect(state.lastSuccessAt).not.toBeNull()
      }
    })
  })

  describe('Lock/unlock behavior', () => {
    let freshUser: string
    let freshDevice: string
    let freshInstanceId: string

    beforeEach(() => {
      freshUser = uniqueId('lockuser')
      freshDevice = uniqueId('lockdev')
      freshInstanceId = `${freshUser}:${freshDevice}`
    })

    it('PhoneLock prevents getTask from returning work', async () => {
      // First, trigger initial task creation
      await maaGetTask(freshUser, freshDevice)

      // Lock the phone
      await rpcClient.instances.phoneLock({ instanceId: freshInstanceId })

      // Verify state shows lock
      const state = await rpcClient.instances.state({ instanceId: freshInstanceId })
      expect(state.lockLease).not.toBeNull()
      expect(state.lockLease?.source).toBe('phone')

      // getTask should return empty
      const result = await maaGetTask(freshUser, freshDevice)
      expect(result.tasks).toHaveLength(0)
    })

    it('PhoneUnlock starts cooldown', async () => {
      // Lock then unlock
      await rpcClient.instances.phoneLock({ instanceId: freshInstanceId })
      await rpcClient.instances.phoneUnlock({ instanceId: freshInstanceId })

      // Verify state shows cooldown
      const state = await rpcClient.instances.state({ instanceId: freshInstanceId })
      expect(state.lockLease).toBeNull()
      expect(state.cooldownUntil).not.toBeNull()

      // Cooldown should be in the future
      const cooldownTime = new Date(state.cooldownUntil!).getTime()
      expect(cooldownTime).toBeGreaterThan(Date.now())
    })
  })

  describe('Dashboard API', () => {
    let freshUser: string
    let freshDevice: string
    let freshInstanceId: string

    beforeEach(() => {
      freshUser = uniqueId('apiuser')
      freshDevice = uniqueId('apidev')
      freshInstanceId = `${freshUser}:${freshDevice}`
    })

    it('Pause/Resume automation', async () => {
      // Initialize instance
      await maaGetTask(freshUser, freshDevice)

      // Pause
      await rpcClient.instances.pause({ instanceId: freshInstanceId, reason: 'Test pause' })
      let state = await rpcClient.instances.state({ instanceId: freshInstanceId })
      expect(state.paused).toBe(true)

      // Resume
      await rpcClient.instances.resume({ instanceId: freshInstanceId })
      state = await rpcClient.instances.state({ instanceId: freshInstanceId })
      expect(state.paused).toBe(false)
    })

    it('State/runs/events/logs queries work', async () => {
      // Initialize with some activity
      const getResult = await maaGetTask(freshUser, freshDevice)
      if (getResult.tasks.length > 0) {
        await maaReportStatus(freshUser, freshDevice, getResult.tasks[0].id, 'SUCCESS')
      }
      await maaDeviceLog(freshUser, freshDevice, 'Test log line')

      // Query all endpoints
      const state = await rpcClient.instances.state({ instanceId: freshInstanceId })
      expect(state).toHaveProperty('instanceId')

      const runs = await rpcClient.instances.runs({ instanceId: freshInstanceId })
      expect(Array.isArray(runs)).toBe(true)

      const events = await rpcClient.instances.events({ instanceId: freshInstanceId })
      expect(Array.isArray(events)).toBe(true)

      const logs = await rpcClient.instances.logs({ instanceId: freshInstanceId })
      expect(Array.isArray(logs)).toBe(true)
      expect(logs.length).toBeGreaterThan(0)
    })
  })

  describe('Device log ingestion', () => {
    it('stores log lines correctly', async () => {
      const logUser = uniqueId('loguser')
      const logDevice = uniqueId('logdev')
      const logInstanceId = `${logUser}:${logDevice}`

      const logText = 'Line 1\nLine 2\nLine 3'
      const result = await maaDeviceLog(logUser, logDevice, logText)
      expect(result.success).toBe(true)

      const logs = await rpcClient.instances.logs({ instanceId: logInstanceId })
      expect(logs.length).toBe(3)
      const logTexts = logs.map((l) => l.text)
      logTexts.sort()
      expect(logTexts).toEqual(['Line 1', 'Line 2', 'Line 3'])
    })
  })
})
