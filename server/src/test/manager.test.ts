import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { dbService } from '../lib/db/service'
import { initDatabase, closeDatabase } from '../lib/db'
import fs from 'node:fs'

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
      
      // Wait for async database save
      await new Promise((resolve) => setTimeout(resolve, 100))

      const savedSchedules = await dbService.getSchedulesByDevice('test-device')
      expect(savedSchedules).toHaveLength(1)
      expect(savedSchedules[0].hour).toBe(3)
      expect(savedSchedules[0].minute).toBe(15)
    })

    it('should remove and delete a schedule', async () => {
      manager.addSchedule({
        task: 'LinkStart',
        hour: 3,
        minute: 15,
      })

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 100))

      manager.removeSchedule('LinkStart|3:15')

      // Wait for async delete
      await new Promise((resolve) => setTimeout(resolve, 100))

      const schedules = await dbService.getSchedulesByDevice('test-device')
      expect(schedules).toHaveLength(0)
    })
  })

  describe('Lock/Unlock Operations', () => {
    it('should lock manager and persist state', async () => {
      fixture.startPolling()
      
      const result = await manager.lock()
      
      expect(result.success).toBe(true)
      expect(manager.locked).toBe(true)

      // Wait for async database update
      await new Promise((resolve) => setTimeout(resolve, 100))

      const state = await dbService.getManagerState('test-device')
      expect(state?.locked).toBe(true)

      fixture.stopPolling()
    })

    it('should unlock manager and persist state', async () => {
      fixture.startPolling()
      
      await manager.lock()
      await manager.unlock()

      expect(manager.locked).toBe(false)

      // Wait for async database update
      await new Promise((resolve) => setTimeout(resolve, 100))

      const state = await dbService.getManagerState('test-device')
      expect(state?.locked).toBe(false)

      fixture.stopPolling()
    })

    it('should prevent queued tasks when locked', async () => {
      await manager.lock()

      expect(() => manager.create('LinkStart')).toThrow('Manager locked')
    })

    it('should allow immediate tasks when locked', async () => {
      fixture.startPolling()
      
      await manager.lock()

      const task = manager.create('HeartBeat')
      expect(task).toBeDefined()
      expect(task.immediate).toBe(true)

      fixture.stopPolling()
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

      // Create multiple tasks
      const task1 = manager.create('HeartBeat')
      const task2 = manager.create('LinkStart')
      const task3 = manager.create('CaptureImageNow')

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
      expect(tasks.length).toBeGreaterThanOrEqual(2) // At least LinkStart and CaptureImageNow (not HeartBeat which is immediate)

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

  describe('Screenshot Polling', () => {
    it('should emit screenshot events', async () => {
      fixture.startPolling()

      const screenshotPromise = new Promise((resolve) => {
        manager.once('screenshot', (snapshot) => {
          resolve(snapshot)
        })
      })

      // Trigger screenshot task
      manager.create('CaptureImageNow')

      const snapshot = await Promise.race([
        screenshotPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
      ])

      expect(snapshot).toBeDefined()

      fixture.stopPolling()
    })
  })

  describe('State Management', () => {
    it('should return correct manager state', () => {
      manager.create('LinkStart')
      manager.create('HeartBeat')

      const state = manager.state

      expect(state.locked).toBe(false)
      expect(state.tasks.length).toBeGreaterThanOrEqual(1) // HeartBeat is immediate, shouldn't be in state
      expect(state.logs).toBeDefined()
    })
  })
})
