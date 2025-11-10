import fs from 'node:fs'

import { describe, it, expect, beforeEach } from 'vitest'

import { runMigrations, closeDatabase } from '../lib/db'
import * as dbService from '../lib/db/service'

describe('Database Service', () => {
  const testDbPath = `/tmp/test-maam-${Date.now()}.db`
  const testDevice = 'test-device-123'
  const testUser = 'test-user'

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

    // Run migrations for fresh database
    runMigrations()
  })

  afterEach(() => {
    // Close database connection
    try {
      closeDatabase()
    } catch (e) {
      // Ignore errors
    }

    // Cleanup test database
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm')
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal')
    } catch (e) {
      // Ignore errors
    }
  })

  describe('Task Operations', () => {
    it('should save and retrieve a task', async () => {
      const taskData = {
        id: 'LinkStart|2025-10-26T03:15:00Z',
        type: 'LinkStart' as const,
        stage: 'PENDING' as const,
        createdAt: '2025-10-26T03:15:00Z',
      }

      await dbService.saveTask(taskData, testDevice)

      const task = await dbService.getTaskById(taskData.id)
      expect(task).toBeDefined()
      expect(task?.id).toBe(taskData.id)
      expect(task?.type).toBe(taskData.type)
      expect(task?.device).toBe(testDevice)
    })

    it('should update a task', async () => {
      const taskData = {
        id: 'LinkStart|2025-10-26T03:15:00Z',
        type: 'LinkStart' as const,
        stage: 'PENDING' as const,
        createdAt: '2025-10-26T03:15:00Z',
      }

      await dbService.saveTask(taskData, testDevice)

      const updatedTask = {
        ...taskData,
        stage: 'DONE' as const,
        status: 'SUCCESS' as const,
        completedAt: '2025-10-26T03:16:00Z',
        duration: 60000,
      }

      await dbService.updateTask(updatedTask)

      const task = await dbService.getTaskById(taskData.id)
      expect(task?.stage).toBe('DONE')
      expect(task?.status).toBe('SUCCESS')
      expect(task?.duration).toBe(60000)
    })

    it('should retrieve tasks by device', async () => {
      const tasks = [
        {
          id: 'LinkStart|2025-10-26T03:15:00Z',
          type: 'LinkStart' as const,
          stage: 'DONE' as const,
          createdAt: '2025-10-26T03:15:00Z',
        },
        {
          id: 'HeartBeat|2025-10-26T03:16:00Z',
          type: 'HeartBeat' as const,
          stage: 'DONE' as const,
          createdAt: '2025-10-26T03:16:00Z',
        },
      ]

      for (const task of tasks) {
        await dbService.saveTask(task, testDevice)
      }

      const retrievedTasks = await dbService.getTasksByDevice(testDevice)
      expect(retrievedTasks).toHaveLength(2)
      expect(retrievedTasks[0].type).toBe('HeartBeat') // Most recent first
      expect(retrievedTasks[1].type).toBe('LinkStart')
    })
  })

  describe('Schedule Operations', () => {
    it('should save and retrieve a schedule', async () => {
      const scheduleData = {
        id: 'LinkStart|3:15',
        type: 'LinkStart' as const,
        hour: 3,
        minute: 15,
        timezone: 'Asia/Shanghai',
        runCount: 0,
      }

      await dbService.saveSchedule(scheduleData, testDevice)

      const schedules = await dbService.getSchedulesByDevice(testDevice)
      expect(schedules).toHaveLength(1)
      expect(schedules[0].id).toBe(scheduleData.id)
      expect(schedules[0].hour).toBe(3)
      expect(schedules[0].minute).toBe(15)
    })

    it('should update a schedule', async () => {
      const scheduleData = {
        id: 'LinkStart|3:15',
        type: 'LinkStart' as const,
        hour: 3,
        minute: 15,
        timezone: 'Asia/Shanghai',
        runCount: 0,
      }

      await dbService.saveSchedule(scheduleData, testDevice)

      const updatedSchedule = {
        ...scheduleData,
        runCount: 5,
        lastRunTime: '2025-10-26T03:15:00Z',
      }

      await dbService.updateSchedule(updatedSchedule)

      const schedules = await dbService.getSchedulesByDevice(testDevice)
      expect(schedules[0].runCount).toBe(5)
      expect(schedules[0].lastRunTime).toBe('2025-10-26T03:15:00Z')
    })

    it('should delete a schedule', async () => {
      const scheduleData = {
        id: 'LinkStart|3:15',
        type: 'LinkStart' as const,
        hour: 3,
        minute: 15,
        timezone: 'Asia/Shanghai',
        runCount: 0,
      }

      await dbService.saveSchedule(scheduleData, testDevice)
      await dbService.deleteSchedule(scheduleData.id)

      const schedules = await dbService.getSchedulesByDevice(testDevice)
      expect(schedules).toHaveLength(0)
    })
  })

  describe('Manager State Operations', () => {
    it('should save and retrieve manager state', async () => {
      await dbService.saveManagerState(testDevice, testUser, 'Asia/Shanghai', false)

      const state = await dbService.getManagerState(testDevice)
      expect(state).toBeDefined()
      expect(state?.device).toBe(testDevice)
      expect(state?.user).toBe(testUser)
      expect(state?.timezone).toBe('Asia/Shanghai')
      expect(state?.locked).toBe(false)
    })

    it('should update manager lock state', async () => {
      await dbService.saveManagerState(testDevice, testUser, 'Asia/Shanghai', false)
      await dbService.updateManagerLockState(testDevice, true)

      const state = await dbService.getManagerState(testDevice)
      expect(state?.locked).toBe(true)
    })
  })

  describe('Device Log Operations', () => {
    it('should save and retrieve device logs', async () => {
      const timestamp = '2025-10-26T03:15:00Z'
      const title = 'Test Log'
      const content = 'This is a test log entry'

      await dbService.saveDeviceLog(testDevice, timestamp, title, content)

      const logs = await dbService.getDeviceLogs(testDevice, 10)
      expect(logs.length).toBeGreaterThanOrEqual(1)
      const savedLog = logs.find((log) => log.title === title)
      expect(savedLog).toBeDefined()
      expect(savedLog?.device).toBe(testDevice)
      expect(savedLog?.content).toBe(content)
    })

    it('should limit retrieved logs', async () => {
      // Save 100 logs
      for (let i = 0; i < 100; i++) {
        await dbService.saveDeviceLog(
          testDevice,
          `2025-10-26T03:${i.toString().padStart(2, '0')}:00Z`,
          `Log ${i}`,
          `Content ${i}`,
        )
      }

      const logs = await dbService.getDeviceLogs(testDevice, 10)
      expect(logs).toHaveLength(10)
      // Should get most recent logs
      expect(logs[0].title).toBe('Log 99')
    })
  })
})
