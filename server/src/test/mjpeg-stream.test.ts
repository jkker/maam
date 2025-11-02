import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { initDatabase, closeDatabase } from '../lib/db'
import { app } from '../index'

describe('MJPEG Screenshot Stream', () => {
  const testDbPath = `/tmp/test-maam-mjpeg-${Date.now()}.db`
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

  it('should return proper MJPEG headers', async () => {
    const res = await app.request('/screenshot-stream')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'multipart/x-mixed-replace;boundary=--boundarystring',
    )
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
    expect(res.headers.get('Connection')).toBe('keep-alive')
  })

  it('should add and remove stream controllers', () => {
    const mockController = {
      enqueue: () => {},
    } as ReadableStreamDefaultController<Uint8Array>

    expect(manager['streamControllers'].size).toBe(0)

    manager.addStreamController(mockController)
    expect(manager['streamControllers'].size).toBe(1)
    expect(manager['screenshotIntervalId']).toBeDefined()

    manager.removeStreamController(mockController)
    expect(manager['streamControllers'].size).toBe(0)
    expect(manager['screenshotIntervalId']).toBeUndefined()
  })
})
