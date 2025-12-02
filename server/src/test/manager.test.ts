import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { MaaDeviceFixture, createTestManager } from '../fixture/device-fixture'
import { MaaManager } from '../MaaManager'

// Mock database service to avoid file I/O in unit tests
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
  getDeviceOrCreate: vi.fn().mockResolvedValue({ id: 'test-device', userId: 'test-user' }),
  validateDeviceOwnership: vi.fn().mockResolvedValue(true),
}))

describe('MaaManager with Device Fixture', () => {
  let manager: MaaManager
  let fixture: MaaDeviceFixture

  beforeEach(() => {
    // Create test manager and fixture
    const testSetup = createTestManager('test-device', 'test-user')
    manager = testSetup.manager
    fixture = testSetup.fixture
  })

  afterEach(() => {
    // Cleanup
    fixture.cleanup()
    manager.scheduler.stop()
    vi.clearAllMocks()
  })

  describe('Task Lifecycle', () => {
    it('should create and complete a task', async () => {
      const task = manager.create('LinkStart')
      expect(task.stage).toBe('PENDING')
      expect(manager.queue).toHaveLength(1)

      // Simulate MAA client polling
      fixture.startPolling()

      // Wait for task to complete
      const completedTask = await fixture.waitForTask(task.id, 2000)

      expect(completedTask).toBeDefined()
      expect(completedTask?.stage).toBe('DONE')
      expect(completedTask?.status).toBeDefined()

      fixture.stopPolling()
    })

    it('should handle immediate tasks', async () => {
      const task = manager.create('HeartBeat')
      expect(task.immediate).toBe(true)

      fixture.startPolling()
      const completedTask = await fixture.waitForTask(task.id, 1000)

      expect(completedTask?.stage).toBe('DONE')

      fixture.stopPolling()
    })
  })

  describe('Schedule Management', () => {
    it('should add a schedule', () => {
      const scheduleData = manager.addSchedule({
        task: 'LinkStart',
        hour: 3,
        minute: 15,
      })

      expect(scheduleData.id).toBe('LinkStart|3:15')
      expect(manager.schedules).toHaveLength(1)
      expect(manager.schedules[0].data.hour).toBe(3)
      expect(manager.schedules[0].data.minute).toBe(15)
    })

    it('should remove a schedule', () => {
      const scheduleId = 'LinkStart|3:15'
      manager.addSchedule({
        task: 'LinkStart',
        hour: 3,
        minute: 15,
      })

      expect(manager.schedules).toHaveLength(1)

      manager.removeSchedule(scheduleId)

      expect(manager.schedules).toHaveLength(0)
    })
  })

  describe('Lock/Unlock', () => {
    it('should lock the manager', async () => {
      expect(manager.locked).toBe(false)

      fixture.startPolling()
      await manager.lock()

      expect(manager.locked).toBe(true)
      expect(manager.queue).toHaveLength(0)

      fixture.stopPolling()
    })

    it('should unlock the manager', async () => {
      fixture.startPolling()

      await manager.lock()
      expect(manager.locked).toBe(true)

      await manager.unlock()

      expect(manager.locked).toBe(false)

      fixture.stopPolling()
    })
  })

  describe('Task Queue Management', () => {
    it('should queue tasks when manager is unlocked', () => {
      const task1 = manager.create('LinkStart')
      const task2 = manager.create('HeartBeat')

      expect(manager.queue).toHaveLength(2)
      expect(manager.queue[0]).toBe(task1)
      expect(manager.queue[1]).toBe(task2)
    })

    it('should not allow non-immediate tasks when locked', async () => {
      fixture.startPolling()
      await manager.lock()

      // Should throw error when trying to create non-immediate task while locked
      expect(() => manager.create('LinkStart')).toThrow('Manager locked')

      fixture.stopPolling()
    })

    it('should still create immediate tasks when locked', async () => {
      fixture.startPolling()
      await manager.lock()

      const task = manager.create('HeartBeat')

      expect(task.stage).toBe('PENDING')
      // Immediate tasks bypass queue check

      fixture.stopPolling()
    })
  })

  describe('Task Retrieval', () => {
    it('should get tasks from queue', () => {
      manager.create('LinkStart')
      manager.create('HeartBeat')

      const tasks = manager.getTask()

      expect(tasks).toHaveLength(2)
      expect(manager.queue).toHaveLength(0) // Queue should be empty after retrieval
    })

    it('should mark tasks as RUNNING when retrieved', () => {
      const task = manager.create('LinkStart')

      manager.getTask()

      expect(task.stage).toBe('RUNNING')
    })
  })

  describe('Task Reporting', () => {
    it('should report task status', () => {
      const task = manager.create('LinkStart')
      manager.getTask() // Move to RUNNING

      const reportedTask = manager.reportStatus({
        task: task.id,
        status: 'SUCCESS',
        payload: undefined,
      })

      expect(reportedTask).toBeDefined()
      expect(reportedTask?.stage).toBe('DONE')
      expect(reportedTask?.status).toBe('SUCCESS')
    })

    it('should handle failed task status', () => {
      const task = manager.create('LinkStart')
      manager.getTask()

      const reportedTask = manager.reportStatus({
        task: task.id,
        status: 'FAILED',
        payload: undefined,
      })

      expect(reportedTask?.status).toBe('FAILED')
    })
  })

  describe('Complete Workflow Simulation', () => {
    it('should handle full task lifecycle', async () => {
      fixture.startPolling()

      // Create task
      const task = manager.create('LinkStart')
      expect(task.stage).toBe('PENDING')

      // Wait for completion
      const completedTask = await fixture.waitForTask(task.id, 2000)

      expect(completedTask?.stage).toBe('DONE')
      expect(['SUCCESS', 'FAILED']).toContain(completedTask?.status)

      fixture.stopPolling()
    })

    it('should handle multiple concurrent tasks', async () => {
      fixture.startPolling()

      const task1 = manager.create('LinkStart')
      const task2 = manager.create('HeartBeat')

      await fixture.waitForAllTasks(3000)

      expect(manager.tasks.get(task1.id)?.stage).toBe('DONE')
      expect(manager.tasks.get(task2.id)?.stage).toBe('DONE')

      fixture.stopPolling()
    })
  })
})
