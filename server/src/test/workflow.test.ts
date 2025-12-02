import type { WorkflowRun } from '../lib/workflow'
import type { WorkflowHookCallback } from '../Task'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { workflowService } from '../lib/workflow'
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
    // Initialize workflow service
    workflowService.initialize()
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

    it('should call workflow hook when task completes via device fixture', async () => {
      fixture.startPolling()

      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('test-hook-token', mockCallback)

      // Wait for task completion via fixture (no mocking - real device simulation)
      const completedTask = await fixture.waitForTask(task.id, 2000)

      expect(completedTask).toBeDefined()
      expect(completedTask?.stage).toBe('DONE')
      expect(mockCallback).toHaveBeenCalledTimes(1)

      // Check that callback was called with correct structure
      const mockFn = mockCallback as ReturnType<typeof vi.fn>
      const callArg = mockFn.mock.calls[0][0] as { status: string }
      expect(['SUCCESS', 'FAILED']).toContain(callArg.status)

      fixture.stopPolling()
    })

    it('should pass correct payload to workflow hook for HeartBeat', async () => {
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

    it('should handle multiple tasks with workflow hooks concurrently', async () => {
      fixture.startPolling()

      const callbacks: WorkflowHookCallback[] = []
      const _tasks = ['LinkStart', 'HeartBeat', 'CaptureImageNow'].map((type) => {
        const task = manager.create(type as Parameters<typeof manager.create>[0])
        const callback: WorkflowHookCallback = vi.fn()
        callbacks.push(callback)
        task.registerWorkflowHook(`hook-${type}`, callback)
        return task
      })

      // Wait for all tasks to complete
      await fixture.waitForAllTasks(5000)

      // All callbacks should have been called
      callbacks.forEach((callback, _index) => {
        expect(callback).toHaveBeenCalledTimes(1)
        const mockFn = callback as ReturnType<typeof vi.fn>
        const callArg = mockFn.mock.calls[0][0] as { status: string }
        expect(['SUCCESS', 'FAILED']).toContain(callArg.status)
      })

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

    it('should handle FAILED status in complete() method', () => {
      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('hook-token', mockCallback)
      task.start()
      task.complete('FAILED', undefined)

      expect(mockCallback).toHaveBeenCalledWith({
        status: 'FAILED',
        payload: undefined,
      })
    })

    it('should handle CANCELLED status in complete() method', () => {
      const task = manager.create('LinkStart')
      const mockCallback: WorkflowHookCallback = vi.fn()

      task.registerWorkflowHook('hook-token', mockCallback)
      task.start()
      task.complete('CANCELLED', undefined)

      expect(mockCallback).toHaveBeenCalledWith({
        status: 'CANCELLED',
        payload: undefined,
      })
    })
  })

  describe('Task without workflow hook (backward compatibility)', () => {
    it('should work normally without workflow hook using device fixture', async () => {
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

    it('should support full lifecycle via device fixture without hooks', async () => {
      fixture.startPolling()

      // Create multiple tasks without workflow hooks
      const task1 = manager.create('LinkStart')
      const task2 = manager.create('HeartBeat')

      // Wait for all tasks to complete
      await fixture.waitForAllTasks(3000)

      // Verify both completed successfully
      expect(manager.tasks.get(task1.id)?.stage).toBe('DONE')
      expect(manager.tasks.get(task2.id)?.stage).toBe('DONE')

      fixture.stopPolling()
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

describe('WorkflowService', () => {
  beforeEach(() => {
    workflowService.initialize()
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(workflowService.isInitialized).toBe(true)
    })

    it('should be idempotent on multiple initializations', () => {
      workflowService.initialize()
      workflowService.initialize()
      expect(workflowService.isInitialized).toBe(true)
    })
  })

  describe('Task workflow management', () => {
    it('should start a task workflow and track it', () => {
      const runId = workflowService.startTaskWorkflow('LinkStart', 'task-123')

      expect(runId).toContain('task-LinkStart')

      const run = workflowService.getWorkflowRun(runId)
      expect(run).toBeDefined()
      expect(run?.type).toBe('task')
      expect(run?.status).toBe('running')
    })

    it('should start an immediate task workflow', () => {
      const runId = workflowService.startImmediateTaskWorkflow('HeartBeat', 'task-456')

      expect(runId).toContain('immediate-HeartBeat')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.type).toBe('immediate-task')
    })

    it('should start a scheduled task workflow', () => {
      const runId = workflowService.startScheduledTaskWorkflow(
        'LinkStart',
        8,
        30,
        'America/New_York',
      )

      expect(runId).toContain('schedule-LinkStart-8:30')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.type).toBe('scheduled-task')
      expect(run?.metadata?.hour).toBe(8)
      expect(run?.metadata?.minute).toBe(30)
    })

    it('should start a delayed unlock workflow', () => {
      const runId = workflowService.startDelayedUnlockWorkflow('device-789', 'user-abc', 10)

      expect(runId).toContain('unlock-device-789')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.type).toBe('delayed-unlock')
      expect(run?.metadata?.delayMinutes).toBe(10)
    })

    it('should start a batch workflow', () => {
      const tasks = [{ type: 'LinkStart' as const }, { type: 'HeartBeat' as const }]
      const runId = workflowService.startBatchWorkflow(tasks)

      expect(runId).toContain('batch')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.type).toBe('batch')
      expect(run?.metadata?.taskCount).toBe(2)
    })
  })

  describe('Hook registration', () => {
    it('should register and retrieve hooks', () => {
      workflowService.registerHook('hook-token-123', 'workflow-run-456', 'task-789')

      const hook = workflowService.getHook('hook-token-123')
      expect(hook).toBeDefined()
      expect(hook?.workflowRunId).toBe('workflow-run-456')
      expect(hook?.taskId).toBe('task-789')
      expect(hook?.status).toBe('pending')
    })

    it('should resume hooks', () => {
      workflowService.registerHook('hook-to-resume', 'workflow-run-1', 'task-1')

      const result = workflowService.resumeHook('hook-to-resume')
      expect(result).toBe(true)

      const hook = workflowService.getHook('hook-to-resume')
      expect(hook?.status).toBe('resumed')
    })

    it('should not resume already resumed hooks', () => {
      workflowService.registerHook('hook-double-resume', 'workflow-run-2', 'task-2')
      workflowService.resumeHook('hook-double-resume')

      const result = workflowService.resumeHook('hook-double-resume')
      expect(result).toBe(false)
    })
  })

  describe('Workflow run lifecycle', () => {
    it('should complete workflow runs', () => {
      const runId = workflowService.startTaskWorkflow('LinkStart', 'task-lifecycle')

      workflowService.completeWorkflowRun(runId, 'completed')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.status).toBe('completed')
      expect(run?.completedAt).toBeDefined()
    })

    it('should mark workflow runs as failed with error', () => {
      const runId = workflowService.startTaskWorkflow('LinkStart', 'task-fail')

      workflowService.completeWorkflowRun(runId, 'failed', 'Test error')

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.status).toBe('failed')
      expect(run?.error).toBe('Test error')
    })

    it('should increment retry count', () => {
      const runId = workflowService.startTaskWorkflow('LinkStart', 'task-retry')

      expect(workflowService.incrementRetryCount(runId)).toBe(1)
      expect(workflowService.incrementRetryCount(runId)).toBe(2)
      expect(workflowService.incrementRetryCount(runId)).toBe(3)

      const run = workflowService.getWorkflowRun(runId)
      expect(run?.retryCount).toBe(3)
    })
  })

  describe('Workflow statistics', () => {
    it('should return accurate statistics', () => {
      // Start some workflows
      const runId1 = workflowService.startTaskWorkflow('LinkStart', 'task-stats-1')
      workflowService.startTaskWorkflow('LinkStart', 'task-stats-2')
      const runId3 = workflowService.startTaskWorkflow('LinkStart', 'task-stats-3')

      // Complete some
      workflowService.completeWorkflowRun(runId1, 'completed')
      workflowService.completeWorkflowRun(runId3, 'failed')

      const stats = workflowService.getStats()
      expect(stats.running).toBeGreaterThanOrEqual(1)
      expect(stats.completed).toBeGreaterThanOrEqual(1)
      expect(stats.failed).toBeGreaterThanOrEqual(1)
    })

    it('should list active runs', () => {
      workflowService.startTaskWorkflow('LinkStart', 'task-active-1')
      workflowService.startTaskWorkflow('LinkStart', 'task-active-2')

      const activeRuns = workflowService.listActiveRuns()
      expect(activeRuns.length).toBeGreaterThanOrEqual(2)
      expect(activeRuns.every((r: WorkflowRun) => r.status === 'running')).toBe(true)
    })
  })
})

describe('Full Workflow Integration with Device Fixture', () => {
  let manager: MaaManager
  let fixture: MaaDeviceFixture

  beforeEach(() => {
    const testSetup = createTestManager('test-device-integration', 'test-user-integration')
    manager = testSetup.manager
    fixture = testSetup.fixture
    workflowService.initialize()
  })

  afterEach(() => {
    fixture.cleanup()
    manager.scheduler.stop()
    vi.clearAllMocks()
  })

  it('should handle complete task lifecycle with workflow tracking', async () => {
    fixture.startPolling()

    // Start workflow tracking
    const task = manager.create('LinkStart')
    const workflowRunId = workflowService.startTaskWorkflow('LinkStart', task.id)

    // Register hook
    const mockCallback: WorkflowHookCallback = vi.fn()
    task.registerWorkflowHook(`task:${task.id}`, mockCallback)
    workflowService.registerHook(`task:${task.id}`, workflowRunId, task.id)

    // Wait for completion via device fixture
    const completedTask = await fixture.waitForTask(task.id, 3000)

    // Verify task completed
    expect(completedTask?.stage).toBe('DONE')
    expect(mockCallback).toHaveBeenCalled()

    // Complete workflow tracking
    workflowService.completeWorkflowRun(
      workflowRunId,
      completedTask?.status === 'SUCCESS' ? 'completed' : 'failed',
    )

    // Resume hook
    workflowService.resumeHook(`task:${task.id}`)

    // Verify workflow state
    const run = workflowService.getWorkflowRun(workflowRunId)
    expect(['completed', 'failed']).toContain(run?.status)
    expect(run?.completedAt).toBeDefined()

    fixture.stopPolling()
  })

  it('should handle lock/unlock with workflow', async () => {
    fixture.startPolling()

    // Start delayed unlock workflow
    const unlockRunId = workflowService.startDelayedUnlockWorkflow(
      manager.device,
      manager.user,
      1, // 1 minute delay
    )

    // Lock the manager
    await manager.lock()
    expect(manager.locked).toBe(true)

    // Verify workflow is running
    const run = workflowService.getWorkflowRun(unlockRunId)
    expect(run?.status).toBe('running')

    // Manually unlock (simulating workflow completion)
    await manager.unlock()
    expect(manager.locked).toBe(false)

    // Complete the workflow
    workflowService.completeWorkflowRun(unlockRunId, 'completed')

    fixture.stopPolling()
  })

  it('should handle batch of tasks with workflow tracking', async () => {
    fixture.startPolling()

    const tasks = [manager.create('HeartBeat'), manager.create('LinkStart')]

    // Start batch workflow
    const batchRunId = workflowService.startBatchWorkflow([
      { type: 'HeartBeat' },
      { type: 'LinkStart' },
    ])

    // Register hooks for all tasks
    tasks.forEach((task) => {
      const callback: WorkflowHookCallback = vi.fn()
      task.registerWorkflowHook(`batch:${task.id}`, callback)
    })

    // Wait for all tasks
    await fixture.waitForAllTasks(5000)

    // Verify all completed
    const allCompleted = tasks.every((t) => manager.tasks.get(t.id)?.stage === 'DONE')
    expect(allCompleted).toBe(true)

    // Complete batch workflow
    workflowService.completeWorkflowRun(batchRunId, 'completed')

    fixture.stopPolling()
  })
})
