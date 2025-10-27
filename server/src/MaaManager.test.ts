import { ToadScheduler } from 'toad-scheduler'
import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from 'vitest'

import { MaaManager, Task } from './MaaManager'

describe('Task', () => {
  beforeAll(() => {})
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves waitFor when the event is emitted before timeout', async () => {
    const task = new Task('id', 'CaptureImageNow')

    const waitPromise = task.waitFor('RUNNING', { milliseconds: 100 })
    task.emit('RUNNING', task)

    await expect(waitPromise).resolves.toBe(task)
  })

  it('rejects waitFor when timeout elapses first', async () => {
    vi.useFakeTimers()
    const task = new Task('id', 'CaptureImageNow')

    const waitPromise = task.waitFor('RUNNING', { milliseconds: 50 })
    vi.runAllTimers()

    await expect(waitPromise).rejects.toBeInstanceOf(Task.TimeoutError)
  })

  it('provides compact data snapshots', () => {
    const task = new Task('id', 'LinkStart', 'payload-data')
    task.status = 'SUCCESS'

    expect(task.data).toMatchObject({
      id: 'id',
      type: 'LinkStart',
      params: 'payload-data',
      status: 'SUCCESS',
      stage: 'PENDING',
    })
    expect(task.data.createdAt).toBeDefined()
  })

  it('correctly identifies immediate task types', () => {
    const immediateTask = new Task('id', 'HeartBeat')
    const queuedTask = new Task('id', 'LinkStart')

    expect(immediateTask.immediate).toBe(true)
    expect(queuedTask.immediate).toBe(false)
  })
})

describe.skip('MaaManager', () => {
  let managerUnderTest: MaaManager
  const frozenInstant = Temporal.Instant.from('2025-01-01T00:00:00Z')

  beforeEach(() => {
    managerUnderTest = new MaaManager('device', 'user', 'UTC')
    vi.spyOn(Temporal.Now, 'instant').mockReturnValue(frozenInstant)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates tasks with deterministic ids and enqueues them', () => {
    const task = managerUnderTest.create('LinkStart', 'params')

    expect(task.id).toContain('LinkStart|2025-01-01T00:00:00')
    expect(managerUnderTest.queue).toContain(task)
    expect(managerUnderTest.tasks.get(task.id)).toBe(task)
  })

  it.skip('locks and unlocks task processing', async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const jobs = [{ start }, { start }]
    const schedulerStub = {
      stop,
      getAllJobs: vi.fn().mockReturnValue(jobs),
      addCronJob: vi.fn(),
      removeById: vi.fn(),
    } as unknown as ToadScheduler

    managerUnderTest.scheduler = schedulerStub

    // Lock creates HeartBeat and potentially StopTask, need to simulate completion
    const lockPromise = managerUnderTest.lock()

    // Complete the HeartBeat task
    const heartbeatTask = Array.from(managerUnderTest.tasks.values()).find(
      (t) => t.type === 'HeartBeat',
    )
    if (heartbeatTask) {
      heartbeatTask.stage = 'RUNNING'
      heartbeatTask.emit('RUNNING', heartbeatTask)
      heartbeatTask.stage = 'DONE'
      heartbeatTask.status = 'SUCCESS'
      heartbeatTask.emit('DONE', heartbeatTask)
    }

    await lockPromise
    expect(managerUnderTest.locked).toBe(true)
    expect(stop).toHaveBeenCalled()

    await managerUnderTest.unlock()
    expect(managerUnderTest.locked).toBe(false)
    expect(start).toHaveBeenCalledTimes(jobs.length)
  })

  it('registers and removes schedules', () => {
    const addCronJob = vi.fn()
    const removeById = vi.fn()
    const schedulerStub = {
      stop: vi.fn(),
      getAllJobs: vi.fn().mockReturnValue([]),
      addCronJob,
      removeById,
    } as unknown as ToadScheduler

    managerUnderTest.scheduler = schedulerStub
    const { id } = managerUnderTest.addSchedule({ task: 'LinkStart', hour: 5, minute: 45 })

    expect(id).toBe('LinkStart|5:45')
    expect(addCronJob).toHaveBeenCalledTimes(1)
    managerUnderTest.removeSchedule(id)
    expect(removeById).toHaveBeenCalledWith(id)
  })
})
