/**
 * Test public oRPC router procedures (no auth required)
 * Following oRPC testing best practices with server-side client
 */
import { call } from '@orpc/server'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { router } from '../index'
import * as dbService from '../lib/db/service'
import { managerService } from '../lib/managers'

// Mock database service
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  getTaskById: vi.fn().mockResolvedValue(null),
  getTasksByDevice: vi.fn().mockResolvedValue([]),
  saveSchedule: vi.fn().mockResolvedValue(undefined),
  updateSchedule: vi.fn().mockResolvedValue(undefined),
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
  getSchedulesByDevice: vi.fn().mockResolvedValue([]),
  saveManagerState: vi.fn().mockResolvedValue(undefined),
  updateManagerLockState: vi.fn().mockResolvedValue(undefined),
  updateManagerHeartbeat: vi.fn().mockResolvedValue(undefined),
  getManagerState: vi.fn().mockResolvedValue(null),
  saveDeviceLog: vi.fn().mockResolvedValue(undefined),
  getDeviceLogs: vi.fn().mockResolvedValue([]),
  getUserOrCreate: vi.fn().mockResolvedValue({ id: 'test-user', name: 'test-user' }),
  getDeviceOrCreate: vi.fn().mockResolvedValue({ id: 'test-device', user: 'test-user' }),
  validateDeviceOwnership: vi.fn().mockResolvedValue(false), // Default to false for first-time auth
  getUser: vi.fn().mockResolvedValue(null),
  getDevice: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({ id: 'test-user', name: 'test-user' }),
}))

// Mock fetch for prts.wiki to avoid network calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve('<html><body></body></html>'),
})

const testUser = 'test-user-public'
const testDevice = 'test-device-public-0123456789'

describe('Public oRPC Procedures (no auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      managerService.removeManager(testDevice, testUser)
    } catch {
      // Ignore if doesn't exist
    }
  })

  afterEach(() => {
    try {
      managerService.removeManager(testDevice, testUser)
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('auth.login', () => {
    it('should successfully register user and device', async () => {
      const result = await call(router.auth.login, {
        user: testUser,
        device: testDevice,
        label: 'Test Device',
      })

      expect(result).toMatchObject({
        success: true,
        user: testUser,
        device: testDevice,
      })

      expect(dbService.getUserOrCreate).toHaveBeenCalledWith(testUser)
      expect(dbService.getDeviceOrCreate).toHaveBeenCalledWith(testDevice, testUser, 'Test Device')
    })

    it('should handle login without optional label', async () => {
      const result = await call(router.auth.login, {
        user: testUser,
        device: testDevice,
      })

      expect(result).toEqual({
        success: true,
        user: testUser,
        device: testDevice,
      })
    })

    it('should reject device ID that is too short', async () => {
      await expect(
        call(router.auth.login, {
          user: testUser,
          device: 'short', // Less than 10 characters
        }),
      ).rejects.toThrow()
    })

    it('should reject empty user', async () => {
      await expect(
        call(router.auth.login, {
          user: '',
          device: testDevice,
        }),
      ).rejects.toThrow()
    })

    it('should pre-warm manager after successful login', async () => {
      const result = await call(router.auth.login, {
        user: testUser,
        device: testDevice,
      })

      expect(result.success).toBe(true)

      // Manager should be created and cached
      const manager = await managerService.getManager(testDevice, testUser)
      expect(manager).toBeDefined()
      expect(manager.device).toBe(testDevice)
      expect(manager.user).toBe(testUser)
    })
  })

  describe('eventCalendar', () => {
    it('should return an array of events', async () => {
      const result = await call(router.eventCalendar, undefined)

      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle empty event list gracefully', async () => {
      const result = await call(router.eventCalendar, undefined)

      // Should not throw, even if empty
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })
})
