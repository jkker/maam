import fs from 'node:fs'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MaaManager } from '../MaaManager'
import { MaaDeviceFixture, createTestManager } from './fixture'
import { app } from '../index'
import { initDatabase, closeDatabase } from '../lib/db'
import { dbService } from '../lib/db/service'

describe('MJPEG Screenshot Stream', () => {
  const testDbPath = `/tmp/test-maam-mjpeg-${Date.now()}.db`
  let manager: MaaManager
  let fixture: MaaDeviceFixture

  beforeEach(async () => {
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

    // Register user and device in database
    await dbService.getUserOrCreate('test-user')
    await dbService.getDeviceOrCreate('test-device', 'test-user')
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
    const res = await app.request('/maa/screenshot.mjpeg', {
      headers: {
        'x-user-id': 'test-user',
        'x-device-id': 'test-device',
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('multipart/x-mixed-replace;boundary=--bound')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
    expect(res.headers.get('Connection')).toBe('keep-alive')
  })
})
