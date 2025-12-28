/**
 * Unified MAA Device Fixture
 *
 * Simulates a MAA device for both unit tests (direct manager interaction)
 * and integration tests (HTTP calls to server).
 *
 * Two modes:
 * 1. Manager mode: Direct MaaManager interaction for unit tests
 * 2. HTTP mode: Uses fetch() to call server endpoints for integration tests
 */

import type { TaskType } from '../lib/schema'
import type { Task } from '../Task'

import { MaaManager } from '../MaaManager'

export interface DeviceFixtureHttpConfig {
  device: string
  user: string
  pollingInterval: number
  baseUrl: string
}

/**
 * Mock MAA device fixture for testing.
 * Simulates a complete MAA client with all protocol interactions.
 *
 * Can operate in two modes:
 * - Manager mode: Pass a MaaManager instance for direct interaction (unit tests)
 * - HTTP mode: Pass config with baseUrl for HTTP requests (integration tests)
 */
export class MaaDeviceFixture {
  private taskQueue: Array<{ id: string; type: TaskType; params?: string }> = []
  private currentTask?: { id: string; type: TaskType; params?: string }
  private pollInterval?: NodeJS.Timeout
  private isRunning = false

  // Manager mode properties
  private manager?: MaaManager
  private pollIntervalMs: number

  // HTTP mode properties
  private httpConfig?: DeviceFixtureHttpConfig

  /**
   * Create a fixture in manager mode (for unit tests)
   */
  constructor(manager: MaaManager, autoPolling?: boolean, pollIntervalMs?: number)
  /**
   * Create a fixture in HTTP mode (for integration tests)
   */
  constructor(config: Partial<DeviceFixtureHttpConfig>)
  constructor(
    managerOrConfig: MaaManager | Partial<DeviceFixtureHttpConfig>,
    autoPolling = false,
    pollIntervalMs = 100,
  ) {
    // Check if the first argument is a MaaManager instance using instanceof
    // This is more robust than checking for specific properties
    if (managerOrConfig instanceof MaaManager) {
      // Manager mode
      this.manager = managerOrConfig
      this.pollIntervalMs = pollIntervalMs
      if (autoPolling) {
        this.startPolling()
      }
    } else if (managerOrConfig && typeof managerOrConfig === 'object') {
      // HTTP mode with config
      this.httpConfig = {
        device: managerOrConfig.device ?? 'test-device-fixture',
        user: managerOrConfig.user ?? 'test-user',
        pollingInterval: managerOrConfig.pollingInterval ?? 2000,
        baseUrl: managerOrConfig.baseUrl ?? 'http://localhost:3113',
      }
      this.pollIntervalMs = this.httpConfig.pollingInterval
    } else {
      // Default HTTP mode with empty config
      this.httpConfig = {
        device: 'test-device-fixture',
        user: 'test-user',
        pollingInterval: 2000,
        baseUrl: 'http://localhost:3113',
      }
      this.pollIntervalMs = this.httpConfig.pollingInterval
    }
  }

  /**
   * Start the device fixture polling loop (HTTP mode alias)
   */
  start() {
    this.startPolling()
  }

  /**
   * Start automatic task polling (simulates MAA client)
   */
  startPolling() {
    if (this.pollInterval || this.isRunning) return

    this.isRunning = true
    if (this.httpConfig) {
      console.log(
        `[Fixture] Starting MAA device fixture with ${this.pollIntervalMs}ms polling interval`,
      )
    }

    this.pollInterval = setInterval(async () => {
      await this.pollTasks()
      await this.processNextTask()
    }, this.pollIntervalMs)
  }

  /**
   * Stop the device fixture (HTTP mode alias)
   */
  stop() {
    this.stopPolling()
  }

  /**
   * Stop automatic task polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
    this.isRunning = false

    if (this.httpConfig) {
      console.log('[Fixture] Stopped MAA device fixture')
    }
  }

  /**
   * Poll tasks from manager or server (simulates POST /maa/getTask)
   */
  async pollTasks() {
    if (this.manager) {
      // Manager mode - direct interaction
      const tasks = this.manager.getTask()
      this.taskQueue.push(...tasks)
      return tasks
    }

    // HTTP mode - fetch from server
    if (!this.httpConfig) return []

    try {
      const response = await fetch(`${this.httpConfig.baseUrl}/maa/getTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: this.httpConfig.device,
          user: this.httpConfig.user,
        }),
      })

      if (!response.ok) {
        console.error(`[Fixture] Failed to get tasks: ${response.status}`)
        return []
      }

      const data = (await response.json()) as {
        tasks: Array<{ id: string; type: TaskType; params?: string }>
      }
      const tasks = data.tasks

      if (tasks.length > 0) {
        console.log(`[Fixture] Received ${tasks.length} task(s)`)
        this.taskQueue.push(...tasks)
      }

      return tasks
    } catch (error) {
      console.error('[Fixture] Error polling for tasks:', error)
      return []
    }
  }

  /**
   * Process next task in queue (simulates MAA client execution)
   */
  async processNextTask() {
    if (this.currentTask || this.taskQueue.length === 0) return

    this.currentTask = this.taskQueue.shift()!
    const { id, type } = this.currentTask

    if (this.httpConfig) {
      console.log(`[Fixture] Executing task: ${type} (${id})`)
    }

    // Simulate task execution delay
    const executionTime = this.getExecutionTime(type)
    await this.delay(executionTime)

    // Generate payload based on task type
    const payload = this.generatePayload(type)

    // Report task completion (90% success rate for manager mode, 100% for HTTP mode)
    const success = this.httpConfig ? true : Math.random() > 0.1
    await this.reportStatus(id, success ? 'SUCCESS' : 'FAILED', payload)

    this.currentTask = undefined
  }

  /**
   * Report task status to manager or server (simulates POST /maa/reportStatus)
   */
  async reportStatus(taskId: string, status: 'SUCCESS' | 'FAILED', payload?: string) {
    if (this.manager) {
      // Manager mode - direct interaction
      this.manager.reportStatus({
        task: taskId,
        status,
        payload,
      })
      return
    }

    // HTTP mode - POST to server
    if (!this.httpConfig) return

    try {
      const response = await fetch(`${this.httpConfig.baseUrl}/maa/reportStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskId,
          status,
          payload,
        }),
      })

      if (!response.ok) {
        console.error(`[Fixture] Failed to report status: ${response.status}`)
        return
      }

      console.log(`[Fixture] Reported ${status} for task ${taskId}`)
    } catch (error) {
      console.error('[Fixture] Error reporting status:', error)
    }
  }

  /**
   * Send device log to manager or server (simulates POST /maa/deviceLog)
   */
  async sendLog(message: string) {
    if (this.manager) {
      // Manager mode - direct interaction
      this.manager.deviceLog(message)
      return
    }

    // HTTP mode - POST to server
    if (!this.httpConfig) return

    try {
      await fetch(`${this.httpConfig.baseUrl}/maa/deviceLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: message,
      })
    } catch (error) {
      console.error('[Fixture] Error sending log:', error)
    }
  }

  /**
   * Simulate task execution time based on task type
   */
  private getExecutionTime(type: TaskType): number {
    switch (type) {
      case 'HeartBeat':
        return this.httpConfig ? 100 : 10
      case 'StopTask':
        return this.httpConfig ? 200 : 50
      case 'CaptureImageNow':
      case 'CaptureImage':
        return this.httpConfig ? 300 : 100
      case 'LinkStart':
      case 'LinkStart-Combat':
      case 'LinkStart-Recruiting':
      case 'LinkStart-Mall':
      case 'LinkStart-Mission':
      case 'LinkStart-AutoRoguelike':
      case 'LinkStart-Reclamation':
      case 'LinkStart-Base':
      case 'LinkStart-WakeUp':
        return this.httpConfig ? 500 : 200
      default:
        return this.httpConfig ? 500 : 100
    }
  }

  /**
   * Generate realistic payload for task types that need it
   */
  private generatePayload(type: TaskType): string | undefined {
    if (type === 'CaptureImageNow' || type === 'CaptureImage') {
      // Generate a small base64 PNG (1x1 transparent pixel)
      return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
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
   * Wait for a specific task to complete (manager mode only)
   */
  async waitForTask(taskId: string, timeout = 5000): Promise<Task | undefined> {
    if (!this.manager) {
      throw new Error('waitForTask is only available in manager mode')
    }

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
   * Wait for all tasks to complete (manager mode only)
   */
  async waitForAllTasks(timeout = 10000): Promise<void> {
    if (!this.manager) {
      throw new Error('waitForAllTasks is only available in manager mode')
    }

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
    await this.sendLog('[10-26 03:15:00][MAA] Task started')

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

  /**
   * Get current configuration (HTTP mode only)
   */
  getConfig(): DeviceFixtureHttpConfig | undefined {
    return this.httpConfig ? { ...this.httpConfig } : undefined
  }

  /**
   * Update polling interval
   */
  setPollingInterval(intervalMs: number) {
    this.pollIntervalMs = intervalMs
    if (this.httpConfig) {
      this.httpConfig.pollingInterval = intervalMs
    }
    if (this.isRunning) {
      // Restart with new interval
      this.stopPolling()
      this.startPolling()
    }
  }
}

/**
 * Create a test MAA manager with fixture (manager mode)
 */
export function createTestManager(device = 'test-device', user = 'test-user') {
  const manager = new MaaManager(device, user)
  const fixture = new MaaDeviceFixture(manager, false)
  return { manager, fixture }
}

/**
 * Create a test manager with auto-polling fixture (manager mode)
 */
export function createTestManagerWithPolling(device = 'test-device', user = 'test-user') {
  const manager = new MaaManager(device, user)
  const fixture = new MaaDeviceFixture(manager, true)
  fixture.startPolling()
  return { manager, fixture }
}
