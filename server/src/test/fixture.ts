import type { TaskType } from '../lib/schema'

import { MaaManager } from '../MaaManager'
import { Task } from '../Task'

/**
 * Mock MAA device fixture for testing
 * Simulates a complete MAA client with all protocol interactions
 */
export class MaaDeviceFixture {
  private taskQueue: Array<{ id: string; type: TaskType; params?: string }> = []
  private currentTask?: { id: string; type: TaskType; params?: string }
  private pollInterval?: NodeJS.Timeout

  constructor(
    private manager: MaaManager,
    private autoPolling = true,
    private pollIntervalMs = 100,
  ) {}

  /**
   * Start automatic task polling (simulates MAA client)
   */
  startPolling() {
    if (this.pollInterval) return

    this.pollInterval = setInterval(async () => {
      this.pollTasks()
      await this.processNextTask()
    }, this.pollIntervalMs)
  }

  /**
   * Stop automatic task polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
  }

  /**
   * Poll tasks from manager (simulates POST /maa/getTask)
   */
  pollTasks() {
    const tasks = this.manager.getTask()
    this.taskQueue.push(...tasks)
    return tasks
  }

  /**
   * Process next task in queue (simulates MAA client execution)
   */
  async processNextTask() {
    if (this.currentTask || this.taskQueue.length === 0) return

    this.currentTask = this.taskQueue.shift()!
    const { id, type } = this.currentTask

    // Simulate task execution delay
    const executionTime = this.getExecutionTime(type)
    await this.delay(executionTime)

    // Report task completion
    const success = Math.random() > 0.1 // 90% success rate
    this.reportStatus(id, success ? 'SUCCESS' : 'FAILED', this.generatePayload(type))

    this.currentTask = undefined
  }

  /**
   * Report task status to manager (simulates POST /maa/reportStatus)
   */
  reportStatus(taskId: string, status: 'SUCCESS' | 'FAILED', payload?: string) {
    this.manager.reportStatus({
      task: taskId,
      status,
      payload,
    })
  }

  /**
   * Send device log to manager (simulates POST /maa/deviceLog)
   */
  sendLog(message: string) {
    this.manager.deviceLog(message)
  }

  /**
   * Simulate task execution time based on task type
   */
  private getExecutionTime(type: TaskType): number {
    switch (type) {
      case 'HeartBeat':
        return 10
      case 'StopTask':
        return 50
      case 'CaptureImageNow':
      case 'CaptureImage':
        return 100
      case 'LinkStart':
      case 'LinkStart-Combat':
      case 'LinkStart-Recruiting':
      case 'LinkStart-Mall':
      case 'LinkStart-Mission':
      case 'LinkStart-AutoRoguelike':
      case 'LinkStart-Reclamation':
      case 'LinkStart-Base':
      case 'LinkStart-WakeUp':
        return 200
      default:
        return 100
    }
  }

  /**
   * Generate realistic payload for task types that need it
   */
  private generatePayload(type: TaskType): string | undefined {
    if (type === 'CaptureImageNow' || type === 'CaptureImage') {
      // Generate a small base64 PNG (1x1 transparent pixel)
      return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    }
    if (type === 'HeartBeat') {
      // Return empty or running task ID
      return Math.random() > 0.8 ? 'LinkStart|2025-10-26T03:15:00Z' : ''
    }
    return undefined
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Wait for a specific task to complete
   */
  async waitForTask(taskId: string, timeout = 5000): Promise<Task | undefined> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const task = this.manager.tasks.get(taskId)
      if (task?.stage === 'DONE') {
        return task
      }
      await this.delay(50)
    }
    return undefined
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForAllTasks(timeout = 10000): Promise<void> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      if (this.taskQueue.length === 0 && !this.currentTask && this.manager.queue.length === 0) {
        return
      }
      await this.delay(100)
    }
    throw new Error('Timeout waiting for all tasks to complete')
  }

  /**
   * Simulate a complete MAA workflow
   */
  async simulateWorkflow() {
    // Start polling
    this.startPolling()

    // Simulate heartbeat
    await this.delay(200)

    // Simulate device logs
    this.sendLog('[10-26 03:15:00][MAA] Task started')

    // Wait for tasks to complete
    await this.delay(500)

    // Stop polling
    this.stopPolling()
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopPolling()
    this.taskQueue = []
    this.currentTask = undefined
  }
}

/**
 * Create a test MAA manager with fixture
 */
export function createTestManager(device = 'test-device', user = 'test-user') {
  const manager = new MaaManager(device, user)
  const fixture = new MaaDeviceFixture(manager, false)
  return { manager, fixture }
}

/**
 * Create a test manager with auto-polling fixture
 */
export function createTestManagerWithPolling(device = 'test-device', user = 'test-user') {
  const manager = new MaaManager(device, user)
  const fixture = new MaaDeviceFixture(manager, true)
  fixture.startPolling()
  return { manager, fixture }
}
