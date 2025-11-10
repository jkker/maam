/**
 * Unit tests for Task class
 * Tests all task lifecycle methods, event emissions, and timeout handling
 */
import { Temporal } from 'temporal-polyfill'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { Task } from '../Task'

// Mock database service - Task doesn't call it directly based on the actual implementation
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
}))

describe('Task', () => {
  let createdAt: Temporal.ZonedDateTime

  beforeEach(() => {
    vi.clearAllMocks()
    createdAt = Temporal.ZonedDateTime.from('2025-11-10T12:00:00[UTC]')
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Constructor', () => {
    it('should create task with correct initial state', () => {
      const task = new Task('HeartBeat', createdAt)

      expect(task.type).toBe('HeartBeat')
      expect(task.createdAt).toBe(createdAt)
      expect(task.stage).toBe('PENDING')
      expect(task.status).toBeUndefined()
      expect(task.params).toBeUndefined()
      expect(task.payload).toBeUndefined()
      expect(task.duration).toBeUndefined()
    })

    it('should create task with params', () => {
      const params = 'custom-params'
      const task = new Task('LinkStart', createdAt, params)

      expect(task.params).toBe(params)
    })

    it('should generate deterministic ID from type and timestamp', () => {
      const task1 = new Task('HeartBeat', createdAt)
      const task2 = new Task('LinkStart', createdAt)

      expect(task1.id).toContain('HeartBeat')
      expect(task2.id).toContain('LinkStart')
      expect(task1.id).toContain('2025-11-10')
    })

    it('should accept custom ID', () => {
      const customId = 'custom-task-id-123'
      const task = new Task('HeartBeat', createdAt, undefined, customId)

      expect(task.id).toBe(customId)
    })

    it('should identify immediate tasks correctly', () => {
      const heartbeat = new Task('HeartBeat', createdAt)
      const stopTask = new Task('StopTask', createdAt)
      const captureNow = new Task('CaptureImageNow', createdAt)
      const linkStart = new Task('LinkStart', createdAt)

      expect(heartbeat.immediate).toBe(true)
      expect(stopTask.immediate).toBe(true)
      expect(captureNow.immediate).toBe(true)
      expect(linkStart.immediate).toBe(false)
    })
  })

  describe('Static methods', () => {
    it('should identify immediate task types', () => {
      expect(Task.isImmediate('HeartBeat')).toBe(true)
      expect(Task.isImmediate('StopTask')).toBe(true)
      expect(Task.isImmediate('CaptureImageNow')).toBe(true)
      expect(Task.isImmediate('LinkStart')).toBe(false)
    })
  })

  describe('Stage Transitions', () => {
    it('should transition to RUNNING stage', () => {
      const task = new Task('HeartBeat', createdAt)
      const startTime = createdAt.add({ seconds: 1 })

      task.stage = 'RUNNING'
      task.startedAt = startTime

      expect(task.stage).toBe('RUNNING')
      expect(task.startedAt).toBe(startTime)
    })

    it('should transition to DONE stage', () => {
      const task = new Task('HeartBeat', createdAt)
      task.stage = 'RUNNING'
      task.startedAt = createdAt

      const endTime = createdAt.add({ seconds: 2 })
      task.stage = 'DONE'
      task.completedAt = endTime

      expect(task.stage).toBe('DONE')
      expect(task.completedAt).toBe(endTime)
    })

    it('should emit events on stage transitions', () => {
      const task = new Task('HeartBeat', createdAt)
      const runningListener = vi.fn()
      const doneListener = vi.fn()

      task.on('RUNNING', runningListener)
      task.on('DONE', doneListener)

      task.emit('RUNNING', task)
      task.emit('DONE', task)

      expect(runningListener).toHaveBeenCalledWith(task)
      expect(doneListener).toHaveBeenCalledWith(task)
    })
  })

  describe('Status and Payload', () => {
    it('should set status to SUCCESS', () => {
      const task = new Task('HeartBeat', createdAt)

      task.status = 'SUCCESS'

      expect(task.status).toBe('SUCCESS')
    })

    it('should set status to FAILED', () => {
      const task = new Task('HeartBeat', createdAt)

      task.status = 'FAILED'

      expect(task.status).toBe('FAILED')
    })

    it('should set status to CANCELLED', () => {
      const task = new Task('HeartBeat', createdAt)

      task.status = 'CANCELLED'

      expect(task.status).toBe('CANCELLED')
    })

    it('should store payload', () => {
      const task = new Task('CaptureImageNow', createdAt)
      const payload = 'base64-encoded-image-data'

      task.payload = payload

      expect(task.payload).toBe(payload)
    })

    it('should store logs', () => {
      const task = new Task('LinkStart', createdAt)
      const logs = 'Task execution logs'

      task.logs = logs

      expect(task.logs).toBe(logs)
    })
  })

  describe('Duration calculation', () => {
    it('should return undefined duration when not started', () => {
      const task = new Task('HeartBeat', createdAt)

      expect(task.duration).toBeUndefined()
    })

    it('should calculate duration between start and completion', () => {
      const task = new Task('HeartBeat', createdAt)
      task.startedAt = createdAt
      task.completedAt = createdAt.add({ seconds: 5 })

      expect(task.duration).toBe(5000) // 5 seconds in milliseconds
    })

    it('should calculate ongoing duration when not yet completed', () => {
      const task = new Task('HeartBeat', createdAt)
      task.startedAt = createdAt

      // Duration should be calculated from start to now
      expect(task.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Image handling', () => {
    it('should decode base64 payload for CaptureImage tasks', () => {
      const task = new Task('CaptureImage', createdAt)
      task.payload = Buffer.from('test-image').toString('base64')

      const image = task.image
      expect(image).toBeInstanceOf(Buffer)
      expect(image!.toString()).toBe('test-image')
    })

    it('should decode base64 payload for CaptureImageNow tasks', () => {
      const task = new Task('CaptureImageNow', createdAt)
      task.payload = Buffer.from('test-screenshot').toString('base64')

      const image = task.image
      expect(image).toBeInstanceOf(Buffer)
      expect(image!.toString()).toBe('test-screenshot')
    })

    it('should throw error when payload is missing', () => {
      const task = new Task('CaptureImageNow', createdAt)

      expect(() => task.image).toThrow('No payload available')
    })
  })

  describe('waitFor', () => {
    it('should resolve immediately if already at target stage', async () => {
      const task = new Task('HeartBeat', createdAt)
      task.stage = 'RUNNING'

      const result = await task.waitFor('RUNNING', { milliseconds: 100 })
      expect(result).toBe(task)
    })

    it('should resolve when stage is reached', async () => {
      const task = new Task('HeartBeat', createdAt)

      // Simulate stage transition after delay
      setTimeout(() => {
        task.stage = 'RUNNING'
        task.emit('RUNNING', task)
      }, 10)

      const result = await task.waitFor('RUNNING', { milliseconds: 500 })
      expect(result).toBe(task)
    })

    it('should throw TimeoutError when timeout expires', async () => {
      const task = new Task('HeartBeat', createdAt)

      await expect(task.waitFor('RUNNING', { milliseconds: 50 })).rejects.toThrow(Task.TimeoutError)
    })

    it('should handle waiting for DONE stage', async () => {
      const task = new Task('HeartBeat', createdAt)

      setTimeout(() => {
        task.stage = 'DONE'
        task.emit('DONE', task)
      }, 10)

      const result = await task.waitFor('DONE', { milliseconds: 500 })
      expect(result).toBe(task)
    })
  })

  describe('data getter', () => {
    it('should return basic task data', () => {
      const task = new Task('HeartBeat', createdAt)

      const data = task.data

      expect(data).toMatchObject({
        id: task.id,
        type: 'HeartBeat',
        stage: 'PENDING',
        createdAt: expect.any(String) as string,
      })
      expect(data.params).toBeUndefined()
      expect(data.status).toBeUndefined()
      expect(data.payload).toBeUndefined()
    })

    it('should include params when provided', () => {
      const task = new Task('LinkStart', createdAt, 'custom-params')

      const data = task.data

      expect(data.params).toBe('custom-params')
    })

    it('should include status when set', () => {
      const task = new Task('HeartBeat', createdAt)
      task.status = 'SUCCESS'

      const data = task.data

      expect(data.status).toBe('SUCCESS')
    })

    it('should include payload when set', () => {
      const task = new Task('CaptureImageNow', createdAt)
      task.payload = 'image-data'

      const data = task.data

      expect(data.payload).toBe('image-data')
    })

    it('should include startedAt and duration when started', () => {
      const task = new Task('HeartBeat', createdAt)
      task.startedAt = createdAt.add({ seconds: 1 })
      task.stage = 'RUNNING'

      const data = task.data

      expect(data.startedAt).toBeDefined()
      expect(data.duration).toBeDefined()
    })

    it('should include completedAt when done', () => {
      const task = new Task('HeartBeat', createdAt)
      task.startedAt = createdAt
      task.completedAt = createdAt.add({ seconds: 2 })
      task.stage = 'DONE'

      const data = task.data

      expect(data.completedAt).toBeDefined()
    })

    it('should include logs when set', () => {
      const task = new Task('LinkStart', createdAt)
      task.logs = 'Execution logs'

      const data = task.data

      expect(data.logs).toBe('Execution logs')
    })
  })
})
