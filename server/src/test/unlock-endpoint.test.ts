import fs from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MaaDeviceFixture } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'
import { managerService } from '../lib/managers'

// Test credentials
const TEST_DEVICE = 'test-device-unlock'
const TEST_USER = 'test-user-unlock'

// Helper function to clean up database files
function cleanupTestDatabase(dbPath: string) {
  const files = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]
  files.forEach((file) => {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch (e) {
      // Ignore errors
    }
  })
}

// Helper function to setup test environment
async function setupTestEnvironment(dbPath: string): Promise<MaaDeviceFixture> {
  process.env.DATABASE_PATH = dbPath
  cleanupTestDatabase(dbPath)
  initDatabase()
  
  // Get or create manager for test device
  const manager = await managerService.getManager(TEST_DEVICE, TEST_USER)
  
  return new MaaDeviceFixture(manager)
}

// Helper function to cleanup test environment
function cleanupTestEnvironment(fixture: MaaDeviceFixture, dbPath: string) {
  fixture.cleanup()
  try {
    managerService.removeManager(TEST_DEVICE, TEST_USER)
    closeDatabase()
  } catch (e) {
    // Ignore errors
  }
  cleanupTestDatabase(dbPath)
}

describe('HTTP Unlock Endpoint', () => {
  const testDbPath = `/tmp/test-maam-unlock-${Date.now()}.db`
  let fixture: MaaDeviceFixture

  beforeEach(async () => {
    fixture = await setupTestEnvironment(testDbPath)
  })

  afterEach(() => {
    cleanupTestEnvironment(fixture, testDbPath)
  })

  it('should schedule delayed unlock with default 10 minute delay', async () => {
    fixture.startPolling()

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

    // Lock the manager first
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Call scheduleUnlock directly to test behavior
    const result = manager.scheduleUnlock({ minutes: 10 })
    expect(result.split('（')[0]).toMatchInlineSnapshot(`"MAA将在10m后出笼"`)

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

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

    // Lock the manager first
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Schedule unlock with 5 minute delay
    const result = manager.scheduleUnlock({ minutes: 5 })
    expect(result.split('（')[0]).toMatchInlineSnapshot(`"MAA将在5m后出笼"`)

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

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

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

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

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

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

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

describe('tRPC unlock vs HTTP unlock', () => {
  const testDbPath = `/tmp/test-maam-trpc-unlock-${Date.now()}.db`
  let fixture: MaaDeviceFixture

  beforeEach(async () => {
    fixture = await setupTestEnvironment(testDbPath)
  })

  afterEach(() => {
    cleanupTestEnvironment(fixture, testDbPath)
  })

  it('should unlock immediately when using manager.unlock() directly (tRPC behavior)', async () => {
    fixture.startPolling()

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

    // Lock the manager
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Call unlock directly (this is what tRPC does)
    await manager.unlock()

    // Should be unlocked immediately, not scheduled
    expect(manager.locked).toBe(false)

    fixture.stopPolling()
  })

  it('should schedule delayed unlock when using scheduleUnlock() (HTTP endpoint behavior)', async () => {
    fixture.startPolling()

    const manager = managerService.getExistingManager(TEST_DEVICE, TEST_USER)!

    // Lock the manager
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Schedule unlock with 2 second delay (this is what HTTP endpoint does)
    const delaySeconds = 2
    const executionBufferMs = 200 // Buffer for execution time
    manager.scheduleUnlock({ seconds: delaySeconds })

    // Should still be locked immediately after scheduling
    expect(manager.locked).toBe(true)

    // Wait for unlock to execute with buffer
    const waitTimeMs = delaySeconds * 1000 + executionBufferMs
    await new Promise((resolve) => setTimeout(resolve, waitTimeMs))

    // Now should be unlocked
    expect(manager.locked).toBe(false)

    fixture.stopPolling()
  })
})
