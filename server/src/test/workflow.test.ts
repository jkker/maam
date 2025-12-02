import type { WorkflowHookCallback } from '../Task'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { MaaManager } from '../MaaManager'
import { Task } from '../Task'
import { MaaDeviceFixture, createTestManager } from './fixture'

// Mock database service
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  getTaskById: vi.fn().mockResolvedValue(null),
  getTasksByDevice: vi.fn().mockResolvedValue([]),
  saveSchedule: vi.fn().mockResolvedValue(undefined),
  updateSchedule: vi.fn().mockResolvedValue(undefined),
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
  getSchedulesByDevice: vi.fn().mockResolvedValue([]),
  saveManagerState: vi.fn().mockResolvedValue(undefined),
  updateManagerLockState: vi.fn().mockResolvedValue(undefined),
  updateManagerHeartbeat: vi.fn().mockResolvedValue(undefined),
  getManagerState: vi.fn().mockResolvedValue(null),
  saveDeviceLog: vi.fn().mockResolvedValue(undefined),
  getDeviceLogs: vi.fn().mockResolvedValue([]),
  getUserOrCreate: vi.fn().mockResolvedValue({ id: 'test-user', name: 'test-user' }),
  getDeviceOrCreate: vi.fn().mockResolvedValue({ id: 'test-device', userId: 'test-user' }),
  validateDeviceOwnership: vi.fn().mockResolvedValue(true),
}))

describe('Task Workflow Integration', () => {
  let manager: MaaManager
  let fixture: MaaDeviceFixture

  beforeEach(() => {
    const testSetup = createTestManager('test-device-workflow', 'test-user-workflow')
    manager = testSetup.manager
    fixture = testSetup.fixture
  })

  afterEach(() => {
    fixture.cleanup()
    manager.scheduler.stop()
    vi.clearAllMocks()
  })

  describe('Task with Workflow Hook', () => {
    it('should register workflow hook on task', () => {
      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('test-hook-token', mockCallback)

      expect(task.workflowHookToken).toBe('test-hook-token')
      expect(task.hasWorkflowHook).toBe(true)
    })

    it('should include workflow hook token in task data', () => {
      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('test-hook-token', mockCallback)

      expect(task.data.workflowHookToken).toBe('test-hook-token')
    })

    it('should call workflow hook when task completes', async () => {
      fixture.startPolling()

      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('test-hook-token', mockCallback)

      // Wait for task completion
      const completedTask = await fixture.waitForTask(task.id, 2000)

      expect(completedTask).toBeDefined()
      expect(completedTask?.stage).toBe('DONE')
      expect(mockCallback).toHaveBeenCalledTimes(1)

      // Check that callback was called with correct structure
      // Status can be SUCCESS or FAILED, payload may or may not be present
      const mockFn = mockCallback as ReturnType<typeof vi.fn>
      const callArg = mockFn.mock.calls[0][0] as { status: string }
      expect(['SUCCESS', 'FAILED']).toContain(callArg.status)

      fixture.stopPolling()
    })

    it('should pass correct payload to workflow hook', async () => {
      fixture.startPolling()

      const task = manager.create('HeartBeat')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('heartbeat-hook', mockCallback)

      // Wait for task completion
      await fixture.waitForTask(task.id, 2000)

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: expect.stringMatching(/SUCCESS|FAILED/),
        }),
      )

      fixture.stopPolling()
    })
  })

  describe('Task start() and complete() methods', () => {
    it('should emit RUNNING event when start() is called', async () => {
      const task = manager.create('LinkStart')
      const runningPromise = task.waitFor('RUNNING', { seconds: 1 })

      // Manually start the task
      task.start()

      await expect(runningPromise).resolves.toBe(task)
      expect(task.stage).toBe('RUNNING')
      expect(task.startedAt).toBeDefined()
    })

    it('should emit DONE event when complete() is called', async () => {
      const task = manager.create('LinkStart')
      task.start()

      const donePromise = task.waitFor('DONE', { seconds: 1 })

      // Complete the task
      task.complete('SUCCESS', 'test-payload')

      await expect(donePromise).resolves.toBe(task)
      expect(task.stage).toBe('DONE')
      expect(task.status).toBe('SUCCESS')
      expect(task.payload).toBe('test-payload')
      expect(task.completedAt).toBeDefined()
    })

    it('should call workflow hook in complete() method', () => {
      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('hook-token', mockCallback)
      task.start()
      task.complete('SUCCESS', 'test-payload')

      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledWith({
        status: 'SUCCESS',
        payload: 'test-payload',
      })
    })
  })

  describe('Task without workflow hook (backward compatibility)', () => {
    it('should work normally without workflow hook', async () => {
      fixture.startPolling()

      const task = manager.create('LinkStart')

      expect(task.hasWorkflowHook).toBe(false)
      expect(task.workflowHookToken).toBeUndefined()

      const completedTask = await fixture.waitForTask(task.id, 2000)

      expect(completedTask).toBeDefined()
      expect(completedTask?.stage).toBe('DONE')

      fixture.stopPolling()
    })

    it('should emit events even without workflow hook', () => {
      const task = manager.create('LinkStart')
      const runningHandler = vi.fn()
      const doneHandler = vi.fn()

      task.on('RUNNING', runningHandler)
      task.on('DONE', doneHandler)

      task.start()
      expect(runningHandler).toHaveBeenCalledWith(task)

      task.complete('SUCCESS')
      expect(doneHandler).toHaveBeenCalledWith(task)
    })
  })

  describe('TaskSchedule workflow integration', () => {
    it('should include lastWorkflowRunId in schedule data when set', () => {
      const scheduleData = manager.addSchedule({
        task: 'LinkStart',
        hour: 8,
        minute: 0,
      })

      const schedule = manager.schedules.find((s) => s.id === scheduleData.id)
      expect(schedule).toBeDefined()

      schedule!.setWorkflowRunId('workflow-run-123')

      const updatedData = schedule!.data
      expect(updatedData.lastWorkflowRunId).toBe('workflow-run-123')
    })

    it('should track workflow run ID across schedule executions', () => {
      const scheduleData = manager.addSchedule({
        task: 'LinkStart',
        hour: 10,
        minute: 30,
      })

      const schedule = manager.schedules.find((s) => s.id === scheduleData.id)
      expect(schedule).toBeDefined()

      // Simulate workflow run tracking
      schedule!.setWorkflowRunId('run-1')
      expect(schedule!.lastWorkflowRunId).toBe('run-1')

      schedule!.setWorkflowRunId('run-2')
      expect(schedule!.lastWorkflowRunId).toBe('run-2')
    })
  })
})

describe('Task class static methods', () => {
  it('should correctly identify immediate tasks', () => {
    expect(Task.isImmediate('HeartBeat')).toBe(true)
    expect(Task.isImmediate('StopTask')).toBe(true)
    expect(Task.isImmediate('CaptureImageNow')).toBe(true)
    expect(Task.isImmediate('LinkStart')).toBe(false)
    expect(Task.isImmediate('CaptureImage')).toBe(false)
  })
})
