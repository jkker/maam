import { MaaManager } from '../MaaManager'
import * as dbService from './db/service'
import { logger } from './logger'

/**
 * Multi-tenant manager system
 * Manages MaaManager instances per device+user pair
 */
class ManagerService {
  private managers = new Map<string, MaaManager>()

  /**
   * Get unique key for device+user pair
   */
  private getKey(deviceId: string, userId: string): string {
    return `${userId}:${deviceId}`
  }

  /**
   * Get or create a manager for a device+user pair
   */
  async getManager(deviceId: string, userId: string): Promise<MaaManager> {
    const key = this.getKey(deviceId, userId)

    let manager = this.managers.get(key)
    if (manager) {
      return manager
    }

    // Ensure user and device exist in database
    await dbService.getUserOrCreate(userId)
    await dbService.getDeviceOrCreate(deviceId, userId)

    // Create new manager instance
    manager = new MaaManager(deviceId, userId)
    this.managers.set(key, manager)

    logger.info(`Created manager for device ${deviceId}, user ${userId}`)
    return manager
  }

  /**
   * Get existing manager without creating
   */
  getExistingManager(deviceId: string, userId: string): MaaManager | undefined {
    return this.managers.get(this.getKey(deviceId, userId))
  }

  /**
   * Remove a manager (cleanup)
   */
  removeManager(deviceId: string, userId: string): void {
    const key = this.getKey(deviceId, userId)
    const manager = this.managers.get(key)
    if (manager) {
      // Cleanup manager resources if needed
      manager.scheduler.stop()
      this.managers.delete(key)
      logger.info(`Removed manager for device ${deviceId}, user ${userId}`)
    }
  }

  /**
   * Get all active managers
   */
  getAllManagers(): MaaManager[] {
    return Array.from(this.managers.values())
  }

  /**
   * Get count of active managers
   */
  getManagerCount(): number {
    return this.managers.size
  }
}

export const managerService = new ManagerService()
