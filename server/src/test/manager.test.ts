import fs from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'
import { dbService } from '../lib/db/service'

describe('MaaManager with Device Fixture', () => {
  const testDbPath = `/tmp/test-maam-manager-${Date.now()}.db`
  let manager: MaaManager
  let fixture: MaaDeviceFixture

  beforeEach(() => {
    // Set test database path
    process.env.DATABASE_PATH = testDbPath

    // Remove existing test database
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm')
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal')
    } catch (e) {
      // Ignore errors
    }

    // Initialize database
    initDatabase()

    // Create test manager and fixture
    const testSetup = createTestManager('test-device', 'test-user')
    manager = testSetup.manager
    fixture = testSetup.fixture
  })

  afterEach(() => {
    // Cleanup
    fixture.cleanup()
    manager.scheduler.stop()

    // Close database connection
    try {
      closeDatabase()
    } catch (e) {
      // Ignore errors
    }

    // Remove test database
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm')
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal')
    } catch (e) {
      // Ignore errors
    }
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

    it('should persist task to database', async () => {
      const task = manager.create('LinkStart')

      // Wait for async database save
      await new Promise((resolve) => setTimeout(resolve, 100))

      const savedTask = await dbService.getTaskById(task.id)
      expect(savedTask).toBeDefined()
      expect(savedTask?.type).toBe('LinkStart')
      expect(savedTask?.stage).toBe('PENDING')
    })

    it('should update task in database on completion', async () => {
      const task = manager.create('LinkStart')

      fixture.startPolling()
      await fixture.waitForTask(task.id, 2000)
      fixture.stopPolling()

      // Wait for async database update
      await new Promise((resolve) => setTimeout(resolve, 100))

      const updatedTask = await dbService.getTaskById(task.id)
      expect(updatedTask?.stage).toBe('DONE')
      expect(updatedTask?.status).toBeDefined()
      expect(updatedTask?.duration).toBeGreaterThan(0)
    })
  })

  describe('Schedule Management', () => {
    it('should add and persist a schedule', async () => {
      const scheduleData = manager.addSchedule({
        task: 'LinkStart',
        hour: 3,
        minute: 15,
      })

      expect(scheduleData.id).toBe('LinkStart|3:15')

      // Wait for async database save to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      const savedSchedules = await dbService.getSchedulesByDevice('test-device')
      // There might be more schedules due to initialization
      const targetSchedule = savedSchedules.find((s) => s.id === 'LinkStart|3:15')
      expect(targetSchedule).toBeDefined()
      expect(targetSchedule?.hour).toBe(3)
      expect(targetSchedule?.minute).toBe(15)
    })

    it('should remove and delete a schedule', async () => {
      const scheduleId = 'LinkStart|3:15'
      manager.addSchedule({
        task: 'LinkStart',
        hour: 3,
        minute: 15,
      })

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Verify it exists
      let schedules = await dbService.getSchedulesByDevice('test-device')
      const beforeCount = schedules.filter((s) => s.id === scheduleId).length
      expect(beforeCount).toBeGreaterThan(0)

      manager.removeSchedule(scheduleId)

      // Wait for async delete
      await new Promise((resolve) => setTimeout(resolve, 200))

      schedules = await dbService.getSchedulesByDevice('test-device')
      const afterCount = schedules.filter((s) => s.id === scheduleId).length
      expect(afterCount).toBe(0)
    })
  })

  describe('Lock/Unlock Operations', () => {
    it('should lock manager and persist state', async () => {
      fixture.startPolling()

      const result = await manager.lock()

      expect(manager.locked).toBe(true)
      // Result might be false if no task was running
      expect(result).toBeDefined()

      // Wait for async database update
      await new Promise((resolve) => setTimeout(resolve, 200))

      const state = await dbService.getManagerState('test-device')
      expect(state?.locked).toBe(true)

      fixture.stopPolling()
    })

    it('should unlock manager and persist state', async () => {
      fixture.startPolling()

      await manager.lock()

      // Wait for lock to settle
      await new Promise((resolve) => setTimeout(resolve, 100))

      await manager.unlock()

      expect(manager.locked).toBe(false)

      // Wait for async database update
      await new Promise((resolve) => setTimeout(resolve, 200))

      const state = await dbService.getManagerState('test-device')
      expect(state?.locked).toBe(false)

      fixture.stopPolling()
    })

    it('should prevent queued tasks when locked', async () => {
      fixture.startPolling()

      await manager.lock()

      expect(() => manager.create('LinkStart')).toThrow('Manager locked')

      fixture.stopPolling()
    })

    it('should allow immediate tasks when locked', async () => {
      fixture.startPolling()

      await manager.lock()

      const task = manager.create('HeartBeat')
      expect(task).toBeDefined()
      expect(task.immediate).toBe(true)

      fixture.stopPolling()
    })

    it('should schedule delayed unlock', async () => {
      fixture.startPolling()

      // Lock the manager first
      await manager.lock()
      expect(manager.locked).toBe(true)

      // Schedule unlock with 1 second delay for testing
      const result = manager.scheduleUnlock({ seconds: 1 })

      expect(result.split('（')[0]).toMatchInlineSnapshot(`"MAA将在1s后出笼"`)
      expect(manager.locked).toBe(true) // Should still be locked

      // Wait for the unlock to execute
      await new Promise((resolve) => setTimeout(resolve, 1200))

      // Manager should now be unlocked
      expect(manager.locked).toBe(false)

      fixture.stopPolling()
    })

    it('should cancel scheduled unlock when locked again', async () => {
      fixture.startPolling()

      // Lock the manager first
      await manager.lock()
      expect(manager.locked).toBe(true)

      // Schedule unlock with 2 second delay
      manager.scheduleUnlock({ seconds: 2 })
      expect(manager.locked).toBe(true)

      // Wait a bit but not long enough for unlock
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Lock again - this should cancel the scheduled unlock
      await manager.lock()

      // Wait past the original unlock time
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Manager should still be locked
      expect(manager.locked).toBe(true)

      fixture.stopPolling()
    })

    it('should cancel scheduled unlock explicitly', async () => {
      fixture.startPolling()

      await manager.lock()

      // Schedule unlock
      manager.scheduleUnlock({ seconds: 2 })

      // Cancel it
      const cancelled = manager.cancelScheduledUnlock()
      expect(cancelled).toBe(true)

      // Wait past the original unlock time
      await new Promise((resolve) => setTimeout(resolve, 2500))

      // Manager should still be locked
      expect(manager.locked).toBe(true)

      fixture.stopPolling()
    })

    it('should return false when cancelling with no scheduled unlock', () => {
      const cancelled = manager.cancelScheduledUnlock()
      expect(cancelled).toBe(false)
    })
  })

  describe('Device Logs', () => {
    it('should save device logs to database', async () => {
      const logMessage = '[10-26 03:15:00][MAA] Task started'
      manager.deviceLog(logMessage)

      // Wait for async database save
      await new Promise((resolve) => setTimeout(resolve, 100))

      const logs = await dbService.getDeviceLogs('test-device')
      expect(logs).toHaveLength(1)
      expect(logs[0].device).toBe('test-device')
    })
  })

  describe('Complete Workflow Simulation', () => {
    it('should handle a complete MAA workflow', async () => {
      fixture.startPolling()

      // Create multiple tasks (mix of immediate and queued)
      const task1 = manager.create('HeartBeat') // immediate
      const task2 = manager.create('LinkStart') // queued
      const task3 = manager.create('CaptureImage') // queued (not CaptureImageNow which is immediate)

      // Wait for all tasks to complete
      await Promise.all([
        fixture.waitForTask(task1.id, 2000),
        fixture.waitForTask(task2.id, 2000),
        fixture.waitForTask(task3.id, 2000),
      ])

      // Verify all tasks completed
      expect(manager.tasks.get(task1.id)?.stage).toBe('DONE')
      expect(manager.tasks.get(task2.id)?.stage).toBe('DONE')
      expect(manager.tasks.get(task3.id)?.stage).toBe('DONE')

      // Send device log
      fixture.sendLog('[10-26 03:15:00][MAA] All tasks completed')

      fixture.stopPolling()

      // Wait for database updates
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Verify database persistence
      const tasks = await dbService.getTasksByDevice('test-device')
      expect(tasks.length).toBeGreaterThanOrEqual(2) // At least LinkStart and CaptureImage (not HeartBeat which is immediate)

      const logs = await dbService.getDeviceLogs('test-device')
      expect(logs.length).toBeGreaterThanOrEqual(1)
    })

    it('should restore schedules from database on restart', async () => {
      // Add schedules
      manager.addSchedule({ task: 'LinkStart', hour: 3, minute: 15 })
      manager.addSchedule({ task: 'HeartBeat', hour: 0, minute: 0 })

      // Wait for database saves
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Create new manager instance (simulates restart)
      const newManager = new MaaManager('test-device', 'test-user')

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Check schedules restored
      expect(newManager.schedules.length).toBeGreaterThanOrEqual(2)

      // Cleanup
      newManager.scheduler.stop()
    })
  })

  describe('Error Handling', () => {
    it('should handle task timeout', async () => {
      const task = manager.create('LinkStart')

      // Don't start fixture polling - task will timeout
      await expect(task.waitFor('DONE', { milliseconds: 100 })).rejects.toThrow()
    })

    it('should handle reporting status for non-existent task', () => {
      const result = manager.reportStatus({
        task: 'non-existent-task',
        status: 'SUCCESS',
      })

      expect(result).toBeUndefined()
    })
  })

  describe('State Management', () => {
    it('should return correct manager state', () => {
      manager.create('LinkStart')
      manager.create('HeartBeat')

      expect(manager.locked).toBe(false)
      expect(manager.state.length).toBeGreaterThanOrEqual(1) // HeartBeat is immediate, shouldn't be in state
      expect(manager.logs).toBeDefined()
    })
  })
})
