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
 *
 * In ArkType, `.default()` makes a field implicitly optional at input while
 * ensuring the output type always includes the field with the default applied.
 * - `minute` defaults to 0 if not provided
 * - `task` defaults to 'LinkStart' if not provided
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
 * Extends Schedule with runtime metadata that is NOT part of the input schema.
 * These fields are added by the server after the schedule is created/restored.
 */
export type ScheduleWithMetadata = Schedule & {
  /** Unique identifier for the schedule (generated from task|hour:minute) */
  id: string
  /** ISO timestamp of last execution */
  lastRunTime?: string
  /** Total number of times this schedule has executed */
  runCount?: number
  /** ISO timestamp of next scheduled execution */
  nextRunTime?: string
  /** ISO timestamp until which the schedule is postponed (cooldown period) */
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

/** Interface for schema objects that support assertion */
interface AssertableSchema<T> {
  assert: (data: unknown) => T
}

/** Interface for schema objects that are callable and return T or errors */
interface CallableSchema<T> {
  (data: unknown): T | type.errors
}

/**
 * Validates and returns typed data, or throws on validation failure
 * @param schema - An ArkType schema with an assert method
 * @param data - The data to validate
 * @returns The validated and typed data
 * @throws ArkErrors if validation fails
 */
export function validate<T>(schema: AssertableSchema<T>, data: unknown): T {
  return schema.assert(data)
}

/**
 * Safe validation that returns a discriminated union result
 * @param schema - An ArkType schema (callable)
 * @param data - The data to validate
 * @returns Object with success: true and data, or success: false and errors
 */
export function safeParse<T>(
  schema: CallableSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: type.errors } {
  const result = schema(data)
  if (result instanceof type.errors) {
    return { success: false, errors: result }
  }
  return { success: true, data: result }
}

/**
 * Delay query parameter schema for unlock endpoint
 * Validates delay is a positive number within reasonable bounds (1-1440 minutes = 1 min to 24 hours)
 */
export const delayQuerySchema = type({
  'delay?': '1 <= number <= 1440',
})
export type DelayQuery = typeof delayQuerySchema.infer
