import type { TaskData } from '../../Task'
import type { ScheduleData } from '../../TaskSchedule'

import { eq, desc } from 'drizzle-orm'

import { tasks, schedules, managerState, deviceLogs, users, devices } from './schema'
import { logger } from '../logger'

import { db } from './index'

export class DatabaseService {
  /**
   * User Operations
   */
  async createUser(userId: string, name: string) {
    try {
      await db.insert(users).values({
        id: userId,
        name,
      })
      logger.info(`User created: ${userId}`)
      return { id: userId, name }
    } catch (error) {
      logger.error(`Failed to create user ${userId}:`, error)
      throw error
    }
  }

  async getUser(userId: string) {
    try {
      const results = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      return results[0]
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error)
      throw error
    }
  }

  async getUserOrCreate(userId: string, name?: string) {
    const user = await this.getUser(userId)
    if (user) return user
    return this.createUser(userId, name || userId)
  }

  /**
   * Device Operations
   */
  async createDevice(deviceId: string, userId: string, name?: string) {
    try {
      await db.insert(devices).values({
        id: deviceId,
        userId,
        name: name || null,
      })
      logger.info(`Device created: ${deviceId} for user ${userId}`)
      return { id: deviceId, userId, name }
    } catch (error) {
      logger.error(`Failed to create device ${deviceId}:`, error)
      throw error
    }
  }

  async getDevice(deviceId: string) {
    try {
      const results = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
      return results[0]
    } catch (error) {
      logger.error(`Failed to get device ${deviceId}:`, error)
      throw error
    }
  }

  async getDeviceOrCreate(deviceId: string, userId: string, name?: string) {
    const device = await this.getDevice(deviceId)
    if (device) {
      // Update last seen
      await this.updateDeviceLastSeen(deviceId)
      return device
    }
    return this.createDevice(deviceId, userId, name)
  }

  async updateDeviceLastSeen(deviceId: string) {
    try {
      await db
        .update(devices)
        .set({ lastSeen: new Date().toISOString() })
        .where(eq(devices.id, deviceId))
    } catch (error) {
      logger.error(`Failed to update last seen for device ${deviceId}:`, error)
    }
  }

  async getDevicesByUser(userId: string) {
    try {
      return await db.select().from(devices).where(eq(devices.userId, userId))
    } catch (error) {
      logger.error(`Failed to get devices for user ${userId}:`, error)
      throw error
    }
  }

  async validateDeviceOwnership(deviceId: string, userId: string): Promise<boolean> {
    try {
      const device = await this.getDevice(deviceId)
      return device?.userId === userId
    } catch (error) {
      logger.error(`Failed to validate device ownership:`, error)
      return false
    }
  }

  /**
   * Task Operations
   */
  async saveTask(taskData: TaskData, device: string) {
    try {
      await db.insert(tasks).values({
        id: taskData.id,
        type: taskData.type,
        stage: taskData.stage,
        status: taskData.status,
        params: taskData.params,
        payload: taskData.payload,
        createdAt: taskData.createdAt,
        startedAt: taskData.startedAt,
        completedAt: taskData.completedAt,
        duration: taskData.duration,
        device,
      })
      logger.debug(`Task saved to database: ${taskData.id}`)
    } catch (error) {
      logger.error(`Failed to save task ${taskData.id}:`, error)
      throw error
    }
  }

  async updateTask(taskData: TaskData, _device: string) {
    try {
      await db
        .update(tasks)
        .set({
          stage: taskData.stage,
          status: taskData.status,
          payload: taskData.payload,
          startedAt: taskData.startedAt,
          completedAt: taskData.completedAt,
          duration: taskData.duration,
        })
        .where(eq(tasks.id, taskData.id))
      logger.debug(`Task updated in database: ${taskData.id}`)
    } catch (error) {
      logger.error(`Failed to update task ${taskData.id}:`, error)
      throw error
    }
  }

  async getTasksByDevice(device: string, limit = 100) {
    try {
      return await db
        .select()
        .from(tasks)
        .where(eq(tasks.device, device))
        .orderBy(desc(tasks.createdAt))
        .limit(limit)
    } catch (error) {
      logger.error(`Failed to get tasks for device ${device}:`, error)
      throw error
    }
  }

  async getTaskById(id: string) {
    try {
      const results = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
      return results[0]
    } catch (error) {
      logger.error(`Failed to get task ${id}:`, error)
      throw error
    }
  }

  /**
   * Schedule Operations
   */
  async saveSchedule(scheduleData: ScheduleData, device: string) {
    try {
      await db.insert(schedules).values({
        id: scheduleData.id,
        type: scheduleData.type,
        hour: scheduleData.hour,
        minute: scheduleData.minute,
        params: scheduleData.params,
        timezone: scheduleData.timezone,
        lastRunTime: scheduleData.lastRunTime,
        runCount: scheduleData.runCount || 0,
        cooldownUntil: scheduleData.cooldownUntil,
        device,
      })
      logger.debug(`Schedule saved to database: ${scheduleData.id}`)
    } catch (error) {
      logger.error(`Failed to save schedule ${scheduleData.id}:`, error)
      throw error
    }
  }

  async updateSchedule(scheduleData: ScheduleData) {
    try {
      await db
        .update(schedules)
        .set({
          lastRunTime: scheduleData.lastRunTime,
          runCount: scheduleData.runCount,
          params: scheduleData.params,
          timezone: scheduleData.timezone,
          cooldownUntil: scheduleData.cooldownUntil,
        })
        .where(eq(schedules.id, scheduleData.id))
      logger.debug(`Schedule updated in database: ${scheduleData.id}`)
    } catch (error) {
      logger.error(`Failed to update schedule ${scheduleData.id}:`, error)
      throw error
    }
  }

  async deleteSchedule(id: string) {
    try {
      await db.delete(schedules).where(eq(schedules.id, id))
      logger.debug(`Schedule deleted from database: ${id}`)
    } catch (error) {
      logger.error(`Failed to delete schedule ${id}:`, error)
      throw error
    }
  }

  async getSchedulesByDevice(device: string) {
    try {
      return await db.select().from(schedules).where(eq(schedules.device, device))
    } catch (error) {
      logger.error(`Failed to get schedules for device ${device}:`, error)
      throw error
    }
  }

  /**
   * Manager State Operations
   */
  async saveManagerState(device: string, user: string, timezone: string, locked = false) {
    try {
      await db
        .insert(managerState)
        .values({
          device,
          user,
          timezone,
          locked,
        })
        .onConflictDoUpdate({
          target: managerState.device,
          set: {
            user,
            timezone,
            locked,
            updatedAt: new Date().toISOString(),
          },
        })
      logger.debug(`Manager state saved for device: ${device}`)
    } catch (error) {
      logger.error(`Failed to save manager state for device ${device}:`, error)
      throw error
    }
  }

  async updateManagerLockState(device: string, locked: boolean) {
    try {
      await db
        .update(managerState)
        .set({
          locked,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(managerState.device, device))
      logger.debug(`Manager lock state updated for device ${device}: ${locked}`)
    } catch (error) {
      logger.error(`Failed to update lock state for device ${device}:`, error)
      throw error
    }
  }

  async updateManagerHeartbeat(device: string) {
    try {
      await db
        .update(managerState)
        .set({
          lastHeartbeat: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(managerState.device, device))
      logger.debug(`Heartbeat updated for device: ${device}`)
    } catch (error) {
      logger.error(`Failed to update heartbeat for device ${device}:`, error)
      throw error
    }
  }

  async getManagerState(device: string) {
    try {
      const results = await db
        .select()
        .from(managerState)
        .where(eq(managerState.device, device))
        .limit(1)
      return results[0]
    } catch (error) {
      logger.error(`Failed to get manager state for device ${device}:`, error)
      throw error
    }
  }

  /**
   * Device Logs Operations
   */
  async saveDeviceLog(device: string, timestamp: string, title: string, content: string) {
    try {
      await db.insert(deviceLogs).values({
        device,
        timestamp,
        title,
        content,
      })
      logger.debug(`Device log saved for device: ${device}`)
    } catch (error) {
      logger.error(`Failed to save device log for device ${device}:`, error)
      throw error
    }
  }

  async getDeviceLogs(device: string, limit = 50) {
    try {
      return await db
        .select()
        .from(deviceLogs)
        .where(eq(deviceLogs.device, device))
        .orderBy(desc(deviceLogs.timestamp))
        .limit(limit)
    } catch (error) {
      logger.error(`Failed to get device logs for device ${device}:`, error)
      throw error
    }
  }
}

export const dbService = new DatabaseService()
