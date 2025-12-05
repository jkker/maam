/**
 * Database service functions using Drizzle ORM
 *
 * This module provides direct database access functions without unnecessary abstraction.
 * All functions use Drizzle's query API for type-safe database operations.
 */

import type { TaskData } from '../../Task'
import type { ScheduleData } from '../../TaskSchedule'

import { eq } from 'drizzle-orm'

import { logger } from '../logger'
import { deviceLogs, devices, managerState, schedules, tasks, users } from './schema'

import { db } from '.'

// ============================================================================
// User Operations
// ============================================================================

export async function createUser(userId: string, name: string) {
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

export async function getUser(userId: string) {
  try {
    const [result] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return result
  } catch (error) {
    logger.error(`Failed to get user ${userId}:`, error)
    throw error
  }
}

export async function getUserOrCreate(userId: string, name?: string) {
  return (await getUser(userId)) || createUser(userId, name || userId)
}

// ============================================================================
// Device Operations
// ============================================================================

export async function getDevice(deviceId: string) {
  try {
    const [result] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
    return result
  } catch (error) {
    logger.error(`Failed to get device ${deviceId}:`, error)
    throw error
  }
}

export async function getDeviceOrCreate(device: string, user: string, label?: string) {
  const existing = await getDevice(device)
  if (existing) return existing

  await db.insert(devices).values({ id: device, user, label })
  return getDevice(device)
}

export async function validateDeviceOwnership(device: string, userId: string): Promise<boolean> {
  try {
    const deviceData = await getDeviceOrCreate(device, userId)
    if (!deviceData) return false
    return deviceData.user === userId
  } catch (error) {
    logger.error(`Failed to validate device ownership:`, error)
    return false
  }
}

// ============================================================================
// Task Operations
// ============================================================================

export async function saveTask(taskData: TaskData, device: string) {
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

export async function updateTask(taskData: TaskData) {
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

// ============================================================================
// Schedule Operations
// ============================================================================

export async function saveSchedule(scheduleData: ScheduleData, device: string) {
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

export async function updateSchedule(scheduleData: ScheduleData) {
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

export async function deleteSchedule(id: string) {
  try {
    await db.delete(schedules).where(eq(schedules.id, id))
    logger.debug(`Schedule deleted from database: ${id}`)
  } catch (error) {
    logger.error(`Failed to delete schedule ${id}:`, error)
    throw error
  }
}

export async function getSchedulesByDevice(device: string) {
  try {
    return await db.select().from(schedules).where(eq(schedules.device, device))
  } catch (error) {
    logger.error(`Failed to get schedules for device ${device}:`, error)
    throw error
  }
}

// ============================================================================
// Manager State Operations
// ============================================================================

export async function saveManagerState(
  device: string,
  user: string,
  timezone: string,
  locked = false,
) {
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

export async function updateManagerLockState(device: string, locked: boolean) {
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

// ============================================================================
// Device Logs Operations
// ============================================================================

export async function saveDeviceLog(
  device: string,
  timestamp: string,
  title: string,
  content: string,
) {
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
