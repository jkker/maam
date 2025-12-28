/**
 * Integration tests for MAA protocol HTTP endpoints
 * Tests the /maa/* endpoints for getTask, reportStatus, and deviceLog
 */

import type { MaaManager } from '../MaaManager'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { app } from '../index'
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
  getDeviceOrCreate: vi.fn().mockResolvedValue({ id: 'test-device-endpoint', userId: 'test-user' }),
  validateDeviceOwnership: vi.fn().mockResolvedValue(true),
}))

const TEST_DEVICE = 'test-device-endpoint'
const TEST_USER = 'test-user'

describe('MAA HTTP Endpoints', () => {
  let manager: MaaManager

  beforeEach(async () => {
    manager = await managerService.getManager(TEST_DEVICE, TEST_USER)
  })

  afterEach(() => {
    manager.scheduler.stop()
    managerService.removeManager(TEST_DEVICE, TEST_USER)
    vi.clearAllMocks()
  })

  describe('POST /maa/getTask', () => {
    it('should return empty task array when no tasks are queued', async () => {
      const res = await app.request('/maa/getTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: TEST_DEVICE, user: TEST_USER }),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { tasks: unknown[] }
      expect(data).toHaveProperty('tasks')
      expect(data.tasks).toEqual([])
    })

    it('should return queued tasks', async () => {
      manager.create('LinkStart')
      manager.create('HeartBeat')

      const res = await app.request('/maa/getTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: TEST_DEVICE, user: TEST_USER }),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { tasks: { type: string }[] }
      expect(data.tasks).toHaveLength(2)
      expect(data.tasks[0].type).toBe('LinkStart')
      expect(data.tasks[1].type).toBe('HeartBeat')
    })

    it('should reject unauthorized requests', async () => {
      const dbService = await import('../lib/db/service')
      vi.mocked(dbService.validateDeviceOwnership).mockResolvedValueOnce(false)

      const res = await app.request('/maa/getTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: 'unauthorized-device', user: 'wrong-user' }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /maa/reportStatus', () => {
    it('should accept valid status reports', async () => {
      const task = manager.create('LinkStart')
      manager.getTask() // Move to RUNNING

      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: TEST_DEVICE,
          user: TEST_USER,
          task: task.id,
          status: 'SUCCESS',
        }),
      })

      expect(res.status).toBe(200)
      expect(task.stage).toBe('DONE')
      expect(task.status).toBe('SUCCESS')
    })

    it('should accept status reports with payload', async () => {
      const task = manager.create('LinkStart')
      manager.getTask()

      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: TEST_DEVICE,
          user: TEST_USER,
          task: task.id,
          status: 'SUCCESS',
          payload: 'Task completed successfully',
        }),
      })

      expect(res.status).toBe(200)
      expect(task.payload).toBe('Task completed successfully')
    })

    it('should accept unknown status values (permissive)', async () => {
      const task = manager.create('LinkStart')
      manager.getTask()

      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: TEST_DEVICE,
          user: TEST_USER,
          task: task.id,
          status: 'CUSTOM_STATUS_FROM_NEW_MAA_VERSION',
        }),
      })

      expect(res.status).toBe(200)
      expect(task.status).toBe('CUSTOM_STATUS_FROM_NEW_MAA_VERSION')
    })

    it('should accept status reports without status field (optional)', async () => {
      const task = manager.create('LinkStart')
      manager.getTask()

      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: TEST_DEVICE,
          user: TEST_USER,
          task: task.id,
        }),
      })

      expect(res.status).toBe(200)
      expect(task.stage).toBe('DONE')
    })

    it('should return 404 for non-existent task', async () => {
      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: TEST_DEVICE,
          user: TEST_USER,
          task: 'non-existent-task-id',
          status: 'SUCCESS',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('should reject unauthorized requests', async () => {
      const dbService = await import('../lib/db/service')
      vi.mocked(dbService.validateDeviceOwnership).mockResolvedValueOnce(false)

      const res = await app.request('/maa/reportStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: 'unauthorized-device',
          user: 'wrong-user',
          task: 'some-task',
          status: 'SUCCESS',
        }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /maa/deviceLog', () => {
    it('should accept raw text logs via query params', async () => {
      const logContent = '[2025-01-01 12:00:00] Test log entry'

      const res = await app.request(`/maa/deviceLog?device=${TEST_DEVICE}&user=${TEST_USER}`, {
        method: 'POST',
        body: logContent,
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean }
      expect(data.success).toBe(true)
      expect(manager.logs).toContain(logContent)
    })

    it('should accept logs via headers', async () => {
      const logContent = 'Log from MAA device'

      const res = await app.request('/maa/deviceLog', {
        method: 'POST',
        headers: {
          'x-maam-device': TEST_DEVICE,
          'x-maam-user': TEST_USER,
        },
        body: logContent,
      })

      expect(res.status).toBe(200)
      expect(manager.logs.some((l) => l.includes(logContent))).toBe(true)
    })

    it('should add timestamp to logs without one', async () => {
      const logContent = 'Log without timestamp'

      await app.request(`/maa/deviceLog?device=${TEST_DEVICE}&user=${TEST_USER}`, {
        method: 'POST',
        body: logContent,
      })

      // Log should have a timestamp prepended
      const lastLog = manager.logs[manager.logs.length - 1]
      expect(lastLog).toMatch(/^\[\d{4}-\d{2}-\d{2}/)
      expect(lastLog).toContain(logContent)
    })

    it('should store any format of log (permissive)', async () => {
      const weirdFormats = [
        'Plain text log',
        '{"json": "log"}',
        '<xml>log</xml>',
        '🎮 Emoji log with unicode: 日本語',
        'Multi\nLine\nLog\nEntry',
      ]

      for (const log of weirdFormats) {
        const res = await app.request(`/maa/deviceLog?device=${TEST_DEVICE}&user=${TEST_USER}`, {
          method: 'POST',
          body: log,
        })
        expect(res.status).toBe(200)
      }

      // All logs should be stored
      expect(manager.logs.length).toBeGreaterThanOrEqual(weirdFormats.length)
    })

    it('should reject requests without auth', async () => {
      const res = await app.request('/maa/deviceLog', {
        method: 'POST',
        body: 'Test log',
      })

      expect(res.status).toBe(401)
    })

    it('should reject unauthorized device/user combo', async () => {
      const dbService = await import('../lib/db/service')
      vi.mocked(dbService.validateDeviceOwnership).mockResolvedValueOnce(false)

      const res = await app.request('/maa/deviceLog?device=bad&user=bad', {
        method: 'POST',
        body: 'Test log',
      })

      expect(res.status).toBe(401)
    })
  })
})
