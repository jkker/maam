import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RPCHandler } from '@orpc/server/fetch'
import { RequestHeadersPlugin } from '@orpc/server/plugins'

import { router } from '../index'
import * as dbService from '../lib/db/service'
import { managerService } from '../lib/managers'

// Test credentials
const testUser = 'test-user-handshake'
const testDevice = 'test-device-handshake-0123456789'
const testDeviceShort = 'short-device' // Invalid - too short

describe('Authentication & Handshake', () => {
  // Setup RPC handler with RequestHeadersPlugin
  const rpcHandler = new RPCHandler(router, {
    plugins: [new RequestHeadersPlugin()],
    interceptors: [],
  })

  const callRPC = async (path: string, input: any, headers: Record<string, string> = {}) => {
    const request = new Request(`http://localhost:3000/rpc/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(input),
    })

    const { matched, response } = await rpcHandler.handle(request, {
      prefix: '/rpc',
      context: {},
    })

    if (!matched) {
      throw new Error('Route not matched')
    }

    const data = await response.json()
    return { status: response.status, data }
  }

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      await managerService.removeManager(testDevice, testUser)
    } catch {
      // Manager doesn't exist, that's fine
    }
  })

  afterEach(async () => {
    // Clean up after each test
    try {
      await managerService.removeManager(testDevice, testUser)
    } catch {
      // Ignore
    }
  })

  describe('Login without headers', () => {
    it('should successfully login without auth headers (public endpoint)', async () => {
      const result = await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
        label: 'Test Device',
      })

      expect(result.status).toBe(200)
      expect(result.data).toMatchObject({
        success: true,
        user: testUser,
        device: testDevice,
      })
    })

    it('should reject login with invalid device ID (too short)', async () => {
      const result = await callRPC('auth.login', {
        user: testUser,
        device: testDeviceShort,
      })

      expect(result.status).toBe(400) // Validation error
    })
  })

  describe('Protected endpoints require auth headers', () => {
    it('should reject requests without auth headers', async () => {
      // First login to create user/device
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      // Try to call protected endpoint without headers
      try {
        await callRPC('start', undefined)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Missing authentication credentials')
      }
    })

    it('should reject requests with only one header', async () => {
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      // Try with only user header
      try {
        await callRPC('start', undefined, {
          'x-maam-user': testUser,
        })
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Missing authentication credentials')
      }

      // Try with only device header
      try {
        await callRPC('start', undefined, {
          'x-maam-device': testDevice,
        })
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Missing authentication credentials')
      }
    })
  })

  describe('Handshake validation on first auth', () => {
    it('should perform handshake and create default schedules on first auth', async () => {
      // Create user and device
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      // Get manager to check initial state
      const manager = await managerService.getManager(testDevice, testUser)
      const initialScheduleCount = manager.schedules.length

      // First protected call should trigger handshake
      // Mock the HeartBeat task to complete immediately
      const originalCreate = manager.create.bind(manager)
      vi.spyOn(manager, 'create').mockImplementation((type, params) => {
        const task = originalCreate(type, params)
        if (type === 'HeartBeat') {
          // Simulate device responding immediately
          setTimeout(() => {
            task.stage = 'RUNNING'
            task.emit('RUNNING', task.data)
            setTimeout(() => {
              task.stage = 'DONE'
              task.status = 'SUCCESS'
              task.emit('DONE', task.data)
            }, 10)
          }, 10)
        }
        return task
      })

      // Call protected endpoint - this triggers handshake
      const result = await callRPC(
        'auth.heartbeat',
        undefined,
        {
          'x-maam-user': testUser,
          'x-maam-device': testDevice,
        },
      )

      expect(result.status).toBe(200)
      expect(result.data).toMatchObject({
        online: true,
        user: testUser,
        device: testDevice,
      })

      // Check that default schedules were created
      const finalScheduleCount = manager.schedules.length
      expect(finalScheduleCount).toBe(initialScheduleCount + 3) // 3 default schedules

      // Verify the schedules are at correct hours
      const scheduleHours = manager.schedules.map((s) => s.data.hour).sort((a, b) => a - b)
      expect(scheduleHours).toContain(4)
      expect(scheduleHours).toContain(12)
      expect(scheduleHours).toContain(20)

      // Verify all default schedules are LinkStart tasks
      const defaultSchedules = manager.schedules.filter((s) =>
        [4, 12, 20].includes(s.data.hour) && s.data.minute === 0,
      )
      expect(defaultSchedules.every((s) => s.data.task === 'LinkStart')).toBe(true)
    })

    it('should skip handshake for already validated devices', async () => {
      // Create user and device
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      // Manually mark device as valid
      await dbService.getUserOrCreate(testUser)
      await dbService.getDeviceOrCreate(testDevice, testUser)

      const manager = await managerService.getManager(testDevice, testUser)
      const createSpy = vi.spyOn(manager, 'create')

      // Call protected endpoint
      const result = await callRPC(
        'locked',
        undefined,
        {
          'x-maam-user': testUser,
          'x-maam-device': testDevice,
        },
      )

      expect(result.status).toBe(200)

      // Verify no HeartBeat task was created (handshake skipped)
      const heartbeatCalls = createSpy.mock.calls.filter(
        (call) => call[0] === 'HeartBeat',
      )
      expect(heartbeatCalls.length).toBe(0)
    })
  })

  describe('Handshake failure scenarios', () => {
    it('should reject auth if heartbeat times out', async () => {
      // Create user and device
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      const manager = await managerService.getManager(testDevice, testUser)

      // Mock create to simulate timeout (task never completes)
      const originalCreate = manager.create.bind(manager)
      vi.spyOn(manager, 'create').mockImplementation((type, params) => {
        const task = originalCreate(type, params)
        if (type === 'HeartBeat') {
          // Simulate device NOT responding (timeout scenario)
          setTimeout(() => {
            task.stage = 'RUNNING'
            task.emit('RUNNING', task.data)
            // Never emit DONE - simulates timeout
          }, 10)
        }
        return task
      })

      // Call protected endpoint - handshake should fail
      try {
        await callRPC(
          'auth.heartbeat',
          undefined,
          {
            'x-maam-user': testUser,
            'x-maam-device': testDevice,
          },
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Device handshake failed')
      }
    }, 20000) // Increase timeout for this test

    it('should not create default schedules if handshake fails', async () => {
      // Create user and device
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      const manager = await managerService.getManager(testDevice, testUser)
      const initialScheduleCount = manager.schedules.length

      // Mock create to fail heartbeat
      const originalCreate = manager.create.bind(manager)
      vi.spyOn(manager, 'create').mockImplementation((type, params) => {
        const task = originalCreate(type, params)
        if (type === 'HeartBeat') {
          setTimeout(() => {
            task.stage = 'RUNNING'
            task.emit('RUNNING', task.data)
            // Never complete
          }, 10)
        }
        return task
      })

      // Try to authenticate - should fail
      try {
        await callRPC(
          'locked',
          undefined,
          {
            'x-maam-user': testUser,
            'x-maam-device': testDevice,
          },
        )
        expect.fail('Should have thrown error')
      } catch {
        // Expected to fail
      }

      // Verify no schedules were created
      expect(manager.schedules.length).toBe(initialScheduleCount)
    }, 20000)
  })

  describe('Header names are case-insensitive', () => {
    it('should accept headers with different casing', async () => {
      await callRPC('auth.login', {
        user: testUser,
        device: testDevice,
      })

      // Try with different casing
      const result = await callRPC(
        'locked',
        undefined,
        {
          'X-MAAM-USER': testUser,
          'X-MAAM-DEVICE': testDevice,
        },
      )

      expect(result.status).toBe(200)
    })
  })
})
