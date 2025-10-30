/**
 * Mock MAA Device Fixture
 * Simulates a MAA device polling the server for tasks and reporting status
 */

import type { TaskType } from './lib/schema'

export interface DeviceFixtureConfig {
  device: string
  user: string
  pollingInterval: number
  baseUrl: string
}

export class MaaDeviceFixture {
  private config: DeviceFixtureConfig
  private isRunning = false
  private pollingIntervalId?: NodeJS.Timeout
  private taskQueue: Array<{ id: string; type: TaskType; params?: string }> = []

  constructor(config: Partial<DeviceFixtureConfig> = {}) {
    this.config = {
      device: config.device ?? 'test-device-fixture',
      user: config.user ?? 'test-user',
      pollingInterval: config.pollingInterval ?? 2000,
      baseUrl: config.baseUrl ?? 'http://localhost:3113',
    }
  }

  /**
   * Start the device fixture polling loop
   */
  start() {
    if (this.isRunning) {
      console.log('Device fixture already running')
      return
    }

    this.isRunning = true
    console.log(`[Fixture] Starting MAA device fixture with ${this.config.pollingInterval}ms polling interval`)

    // Start polling for tasks
    this.pollingIntervalId = setInterval(() => {
      void this.pollForTasks()
    }, this.config.pollingInterval)
  }

  /**
   * Stop the device fixture
   */
  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId)
      this.pollingIntervalId = undefined
    }

    console.log('[Fixture] Stopped MAA device fixture')
  }

  /**
   * Poll the server for tasks
   */
  private async pollForTasks() {
    try {
      const response = await fetch(`${this.config.baseUrl}/maa/getTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: this.config.device,
          user: this.config.user,
        }),
      })

      if (!response.ok) {
        console.error(`[Fixture] Failed to get tasks: ${response.status}`)
        return
      }

      const data = (await response.json()) as { tasks: Array<{ id: string; type: TaskType; params?: string }> }
      const tasks = data.tasks

      if (tasks.length > 0) {
        console.log(`[Fixture] Received ${tasks.length} task(s)`)
        this.taskQueue.push(...tasks)

        // Process tasks
        for (const task of tasks) {
          await this.executeTask(task)
        }
      }
    } catch (error) {
      console.error('[Fixture] Error polling for tasks:', error)
    }
  }

  /**
   * Simulate task execution
   */
  private async executeTask(task: { id: string; type: TaskType; params?: string }) {
    console.log(`[Fixture] Executing task: ${task.type} (${task.id})`)

    // Simulate execution delay
    const delay = this.getExecutionDelay(task.type)
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Generate payload based on task type
    const payload = this.generatePayload(task.type)

    // Report task completion
    await this.reportStatus(task.id, 'SUCCESS', payload)
  }

  /**
   * Get execution delay for different task types
   */
  private getExecutionDelay(type: TaskType): number {
    switch (type) {
      case 'HeartBeat':
        return 100
      case 'CaptureImageNow':
      case 'CaptureImage':
        return 300
      case 'StopTask':
        return 200
      default:
        return 500
    }
  }

  /**
   * Generate payload for different task types
   */
  private generatePayload(type: TaskType): string | undefined {
    switch (type) {
      case 'CaptureImageNow':
      case 'CaptureImage':
        // Generate a simple base64 encoded 1x1 PNG
        return this.generateMockScreenshot()
      case 'HeartBeat':
        return undefined
      default:
        return undefined
    }
  }

  /**
   * Generate a mock screenshot (1x1 transparent PNG in base64)
   */
  private generateMockScreenshot(): string {
    // This is a valid 1x1 transparent PNG in base64
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }

  /**
   * Report task status to the server
   */
  private async reportStatus(taskId: string, status: 'SUCCESS' | 'FAILED', payload?: string) {
    try {
      const response = await fetch(`${this.config.baseUrl}/maa/reportStatus`, {
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
   * Send device logs to the server
   */
  async sendLog(message: string) {
    try {
      await fetch(`${this.config.baseUrl}/maa/deviceLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: message,
      })
    } catch (error) {
      console.error('[Fixture] Error sending log:', error)
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config }
  }

  /**
   * Update polling interval
   */
  setPollingInterval(intervalMs: number) {
    this.config.pollingInterval = intervalMs
    if (this.isRunning) {
      // Restart with new interval
      this.stop()
      this.start()
    }
  }
}
