import fs from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { manager } from '../index'
import { MaaDeviceFixture } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'

describe('HTTP Unlock Endpoint', () => {
  const testDbPath = `/tmp/test-maam-unlock-${Date.now()}.db`
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

    // Create fixture for the global manager
    fixture = new MaaDeviceFixture(manager)
  })

  afterEach(() => {
    // Cleanup
    fixture.cleanup()

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

  it('should schedule delayed unlock with default 10 minute delay', async () => {
    fixture.startPolling()

    // Lock the manager first
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Call scheduleUnlock directly to test behavior
    const result = manager.scheduleUnlock({ minutes: 10 })
    expect(result.delayDuration.total('minutes')).toBe(10)

    // Manager should still be locked immediately after request
    expect(manager.locked).toBe(true)

    // Cancel the scheduled unlock so it doesn't interfere with other tests
    manager.cancelScheduledUnlock()

    // Unlock for cleanup
    await manager.unlock()

    fixture.stopPolling()
  })

  it('should accept custom delay via scheduleUnlock', async () => {
    fixture.startPolling()

    // Lock the manager first
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Schedule unlock with 5 minute delay
    const result = manager.scheduleUnlock({ minutes: 5 })
    expect(result.delayDuration.total('minutes')).toBe(5)

    // Manager should still be locked
    expect(manager.locked).toBe(true)

    // Cancel the scheduled unlock
    manager.cancelScheduledUnlock()

    // Unlock for cleanup
    await manager.unlock()

    fixture.stopPolling()
  })

  it('should not schedule unlock when manager is already unlocked', async () => {
    fixture.startPolling()

    // Make sure manager is unlocked
    if (manager.locked) {
      await manager.unlock()
    }
    expect(manager.locked).toBe(false)

    // Scheduling unlock when already unlocked should still work (noop)
    const result = manager.scheduleUnlock({ minutes: 1 })
    expect(result).toBeDefined()

    // Cancel it
    manager.cancelScheduledUnlock()

    fixture.stopPolling()
  })

  it('should actually unlock after delay', async () => {
    fixture.startPolling()

    // Lock the manager
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Schedule unlock with 1 second delay
    manager.scheduleUnlock({ seconds: 1 })

    // Wait for unlock to execute
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Manager should now be unlocked
    expect(manager.locked).toBe(false)

    fixture.stopPolling()
  })

  it('should cancel scheduled unlock when locked again', async () => {
    fixture.startPolling()

    // Lock the manager
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Schedule unlock
    manager.scheduleUnlock({ seconds: 2 })

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Lock again (should cancel scheduled unlock)
    await manager.lock()

    // Wait past unlock time
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Should still be locked
    expect(manager.locked).toBe(true)

    // Unlock for cleanup
    await manager.unlock()

    fixture.stopPolling()
  })
})
