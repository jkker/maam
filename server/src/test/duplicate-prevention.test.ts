import fs from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'

describe('Duplicate Task Prevention', () => {
  const testDbPath = `/tmp/test-maam-duplicate-${Date.now()}.db`
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

  it('should prevent duplicate tasks in queue', () => {
    // Create first task
    const task1 = manager.create('LinkStart')
    expect(manager.queue).toHaveLength(1)

    // Try to create duplicate task
    const task2 = manager.create('LinkStart')

    // Should return the same task
    expect(task2.id).toBe(task1.id)
    expect(manager.queue).toHaveLength(1)
  })

  it('should prevent duplicate tasks with same params in queue', () => {
    // Create first task with params
    const task1 = manager.create('Settings-Stage1', '1-7')
    expect(manager.queue).toHaveLength(1)

    // Try to create duplicate task with same params
    const task2 = manager.create('Settings-Stage1', '1-7')

    // Should return the same task
    expect(task2.id).toBe(task1.id)
    expect(manager.queue).toHaveLength(1)
  })

  it('should allow tasks with different params', () => {
    // Create first task with params
    const task1 = manager.create('Settings-Stage1', '1-7')
    expect(manager.queue).toHaveLength(1)

    // Create task with different params
    const task2 = manager.create('Settings-Stage1', 'CE-6')

    // Should create a new task
    expect(task2.id).not.toBe(task1.id)
    expect(manager.queue).toHaveLength(2)
  })

  it('should prevent duplicate running tasks', async () => {
    // Create and start running a task
    const task1 = manager.create('LinkStart')
    fixture.startPolling()

    // Wait for task to start running
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(task1.stage).toBe('RUNNING')

    // Try to create duplicate task while first is running
    const task2 = manager.create('LinkStart')

    // Should return the same running task
    expect(task2.id).toBe(task1.id)

    fixture.stopPolling()
  })

  it('should allow immediate tasks to be duplicated', async () => {
    // Create first immediate task
    const task1 = manager.create('HeartBeat')

    // Add a tiny delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Create second immediate task (should be allowed)
    const task2 = manager.create('HeartBeat')

    // Should create different tasks (immediate tasks are always allowed)
    expect(task2.id).not.toBe(task1.id)
    expect(manager.queue).toHaveLength(2)
  })

  it('should allow new task after previous completes', async () => {
    // Create and complete first task
    const task1 = manager.create('LinkStart')
    fixture.startPolling()

    await fixture.waitForTask(task1.id, 2000)
    expect(task1.stage).toBe('DONE')

    // Create new task of same type
    const task2 = manager.create('LinkStart')

    // Should create a new task
    expect(task2.id).not.toBe(task1.id)

    fixture.stopPolling()
  })

  it('should prevent duplicate tasks of different types', () => {
    // Create first task
    const task1 = manager.create('LinkStart-Combat')
    expect(manager.queue).toHaveLength(1)

    // Create different task type
    const task2 = manager.create('LinkStart-Base')

    // Should create a new task (different types)
    expect(task2.id).not.toBe(task1.id)
    expect(manager.queue).toHaveLength(2)
  })
})
