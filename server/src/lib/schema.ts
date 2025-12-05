/**
 * Schema definitions using ArkType - Single Source of Truth
 *
 * All type definitions for the project are defined here.
 * Both server and client code should import types from this module.
 */
import { type } from 'arktype'

import { IMMEDIATE_TASK, TASK_TYPE } from '../const'

// ============================================================================
// Core Type Literals (Single Source of Truth)
// ============================================================================

/** Task status values (includes CANCELLED for internal use) */
export const TASK_STATUS = ['PENDING', 'FAILED', 'SUCCESS', 'CANCELLED'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

/** Task stage values */
export const TASK_STAGE = ['PENDING', 'RUNNING', 'DONE'] as const
export type TaskStage = (typeof TASK_STAGE)[number]

/** Report status values (subset of TaskStatus) */
export const REPORT_STATUS = ['FAILED', 'SUCCESS'] as const
export type ReportStatus = (typeof REPORT_STATUS)[number]

/** Task types - re-export from const for convenience */
export type TaskType = (typeof TASK_TYPE)[number]
export type ImmediateTask = (typeof IMMEDIATE_TASK)[number]

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Device authentication schema
 * Used for authenticating MAA clients
 */
export const deviceSchema = type({
  device: 'string >= 10', // Device ID must be at least 10 characters
  user: 'string',
})
export type Device = typeof deviceSchema.infer

/**
 * Task status report schema
 * Used when MAA client reports task completion
 */
export const reportSchema = type({
  user: 'string',
  device: 'string',
  task: 'string',
  status: "'FAILED' | 'SUCCESS'",
  'payload?': 'string',
})
export type Report = typeof reportSchema.infer

/**
 * Schedule input schema
 * Used when creating new schedules
 * Note: `task` has a default of 'LinkStart', `minute` has a default of 0
 */
export const scheduleSchema = type({
  hour: '0 <= number <= 23',
  minute: type('0 <= number <= 59').default(0),
  task: type.enumerated(...TASK_TYPE).default('LinkStart'),
  'params?': 'string',
  'timezone?': 'string',
})
export type Schedule = typeof scheduleSchema.infer

/**
 * Schedule with metadata (returned from API)
 */
export type ScheduleWithMetadata = Schedule & {
  id: string
  lastRunTime?: string
  runCount?: number
  nextRunTime?: string
  cooldownUntil?: string
}

/**
 * Task record schema
 * Full task data structure with all fields
 */
export const taskSchema = type({
  id: 'string',
  type: type.enumerated(...TASK_TYPE),
  'params?': 'string',
  stage: "'PENDING' | 'RUNNING' | 'DONE'",
  'status?': "'PENDING' | 'FAILED' | 'SUCCESS' | 'CANCELLED'",
  'payload?': 'string',
  'createdAt?': 'string',
  'startedAt?': 'string',
  'completedAt?': 'string',
  'duration?': 'number',
})
export type TaskRecord = typeof taskSchema.infer

/**
 * Log line schema
 */
export const logLineSchema = type({
  timestamp: 'string',
  src: 'string',
  content: 'string',
})
export type LogLine = typeof logLineSchema.infer

/**
 * Log record schema
 */
export const logRecordSchema = type({
  timestamp: 'string',
  title: 'string',
  lines: logLineSchema.array(),
})
export type LogRecord = typeof logRecordSchema.infer

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates and returns typed data, or throws on validation failure
 */
export function validate<T>(schema: { assert: (data: unknown) => T }, data: unknown): T {
  return schema.assert(data)
}

/**
 * Safe validation that returns result or errors
 */
export function safeParse<T>(
  schema: { (data: unknown): T | type.errors },
  data: unknown,
): { success: true; data: T } | { success: false; errors: type.errors } {
  const result = schema(data)
  if (result instanceof type.errors) {
    return { success: false, errors: result }
  }
  return { success: true, data: result }
}
