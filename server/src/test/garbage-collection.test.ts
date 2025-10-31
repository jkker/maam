import fs from 'node:fs'

import { Temporal } from 'temporal-polyfill'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'

describe('Garbage Collection', () => {
  const testDbPath = `/tmp/test-maam-gc-${Date.now()}.db`
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
    manager.cleanup()

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

  it('should mark stale running tasks as FAILED after 24 hours', async () => {
    // Create a task and mark it as running
    const task = manager.create('LinkStart')
    fixture.startPolling()

    // Wait a bit for task to be picked up
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(task.stage).toBe('RUNNING')

    // Stop polling to prevent task completion
    fixture.stopPolling()

    // Mock the task's startedAt to be 25 hours ago
    const now = Temporal.Now.instant().toZonedDateTimeISO('UTC')
    task.startedAt = now.subtract({ hours: 25 })

    // Run garbage collection manually
    manager.runGarbageCollection()

    // Task should now be marked as FAILED
    expect(task.stage).toBe('DONE')
    expect(task.status).toBe('FAILED')
    expect(task.completedAt).toBeDefined()
  })

  it('should mark stale pending tasks as FAILED after 24 hours', () => {
    // Create a task but don't start polling (so it stays pending)
    const task = manager.create('LinkStart')
    expect(task.stage).toBe('PENDING')

    // Mock the task's createdAt to be 25 hours ago
    const now = Temporal.Now.instant().toZonedDateTimeISO('UTC')
    task.createdAt = now.subtract({ hours: 25 })

    // Run garbage collection manually
    manager.runGarbageCollection()

    // Task should now be marked as FAILED
    expect(task.stage).toBe('DONE')
    expect(task.status).toBe('FAILED')
    expect(task.completedAt).toBeDefined()
  })

  it('should not mark recent tasks as FAILED', async () => {
    // Create a task
    const task = manager.create('LinkStart')
    fixture.startPolling()

    // Wait a bit for task to start running
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(task.stage).toBe('RUNNING')

    // Stop polling to prevent completion
    fixture.stopPolling()

    // Run garbage collection
    manager.runGarbageCollection()

    // Task should still be running (not old enough)
    expect(task.stage).toBe('RUNNING')
    expect(task.status).toBeUndefined()
  })

  it('should not affect immediate tasks', async () => {
    // Create an immediate task
    const task = manager.create('HeartBeat')
    fixture.startPolling()

    await fixture.waitForTask(task.id, 1000)
    fixture.stopPolling()

    // Mock the task's createdAt to be 25 hours ago
    const now = Temporal.Now.instant().toZonedDateTimeISO('UTC')
    task.createdAt = now.subtract({ hours: 25 })
    // Manually set stage to RUNNING to test GC skips immediate tasks
    // This is acceptable in this test as we're testing the GC logic, not the task lifecycle
    task.stage = 'RUNNING'

    // Run garbage collection
    manager.runGarbageCollection()

    // Immediate task should not be affected
    expect(task.stage).toBe('RUNNING')
  })

  it('should not affect already completed tasks', async () => {
    // Create and complete a task
    const task = manager.create('LinkStart')
    fixture.startPolling()

    const completedTask = await fixture.waitForTask(task.id, 2000)
    expect(completedTask?.stage).toBe('DONE')

    fixture.stopPolling()

    // Mock the task's createdAt to be 25 hours ago
    const now = Temporal.Now.instant().toZonedDateTimeISO('UTC')
    task.createdAt = now.subtract({ hours: 25 })

    const originalStatus = task.status

    // Run garbage collection
    manager.runGarbageCollection()

    // Task should remain as it was
    expect(task.stage).toBe('DONE')
    expect(task.status).toBe(originalStatus)
  })
})
