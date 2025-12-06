/**
 * Schema definitions using ArkType - Single Source of Truth
 *
 * All validation schemas and types are defined here using ArkType.
 * Types are derived directly from schemas or DB schema - no duplicate declarations.
 * Uses arkregex for type-safe regex patterns.
 *
 * @see https://arktype.io/docs/scopes
 * @see https://github.com/arktypeio/arktype/tree/main/ark/regex
 */
import { regex } from 'arkregex'
import { type } from 'arktype'
import { createSelectSchema, createInsertSchema } from 'drizzle-arktype'

import { IMMEDIATE_TASK, TASK_TYPE } from '../const'
import * as dbSchema from './db/schema'

// ============================================================================
// Drizzle-ArkType schemas - Single Source of Truth from database schema
// These schemas are inferred directly from Drizzle table definitions.
// ============================================================================

/** Schema for inserting new schedules into DB - inferred from Drizzle */
export const scheduleDbInsertSchema = createInsertSchema(dbSchema.schedules)
export type ScheduleDbInsert = typeof scheduleDbInsertSchema.infer

/** Schema for selecting schedules from DB - inferred from Drizzle */
export const scheduleDbSelectSchema = createSelectSchema(dbSchema.schedules)
export type ScheduleDbSelect = typeof scheduleDbSelectSchema.infer

/** Schema for inserting tasks into DB - inferred from Drizzle */
export const taskDbInsertSchema = createInsertSchema(dbSchema.tasks)
export type TaskDbInsert = typeof taskDbInsertSchema.infer

/** Schema for selecting tasks from DB - inferred from Drizzle */
export const taskDbSelectSchema = createSelectSchema(dbSchema.tasks)
export type TaskDbSelect = typeof taskDbSelectSchema.infer

/** Schema for selecting manager state from DB - inferred from Drizzle */
export const managerStateDbSelectSchema = createSelectSchema(dbSchema.managerState)
export type ManagerStateDbSelect = typeof managerStateDbSelectSchema.infer

/** Schema for selecting devices from DB - inferred from Drizzle */
export const deviceDbSelectSchema = createSelectSchema(dbSchema.devices)
export type DeviceDbSelect = typeof deviceDbSelectSchema.infer

/** Schema for device logs from DB - inferred from Drizzle */
export const deviceLogDbSelectSchema = createSelectSchema(dbSchema.deviceLogs)
export type DeviceLogDbSelect = typeof deviceLogDbSelectSchema.infer

// ============================================================================
// Core enumerated types - Single Source of Truth from const.ts
// ============================================================================

/** Task type schema - validates against TASK_TYPE constant */
export const taskTypeSchema = type.enumerated(...TASK_TYPE)
export type TaskType = typeof taskTypeSchema.infer

/** Immediate task schema - validates against IMMEDIATE_TASK constant */
export const immediateTaskSchema = type.enumerated(...IMMEDIATE_TASK)
export type ImmediateTask = typeof immediateTaskSchema.infer

/** Task stage schema - derived as literal union */
export const taskStageSchema = type("'PENDING' | 'RUNNING' | 'DONE'")
export type TaskStage = typeof taskStageSchema.infer

/** Task status schema (includes CANCELLED for internal use) */
export const taskStatusSchema = type("'PENDING' | 'FAILED' | 'SUCCESS' | 'CANCELLED'")
export type TaskStatus = typeof taskStatusSchema.infer

/** Report status schema - subset for MAA client reports */
export const reportStatusSchema = type("'FAILED' | 'SUCCESS'")
export type ReportStatus = typeof reportStatusSchema.infer

// ============================================================================
// API Input schemas - for request validation
// These transform API field names to match DB schema where needed.
// ============================================================================

/** Device authentication schema for MAA client auth */
export const deviceSchema = type({
  device: 'string >= 10',
  user: 'string',
})
export type Device = typeof deviceSchema.infer

/** Task status report schema from MAA client */
export const reportSchema = type({
  user: 'string',
  device: 'string',
  task: 'string',
  status: reportStatusSchema,
  'payload?': 'string',
})
export type Report = typeof reportSchema.infer

/**
 * Schedule input schema with defaults - API-facing schema
 * Maps 'task' field to 'type' field in DB schema
 */
export const scheduleSchema = type({
  hour: '0 <= number.integer <= 23',
  minute: type('0 <= number.integer <= 59').default(0),
  task: taskTypeSchema.default('LinkStart'),
  'params?': 'string',
  'timezone?': 'string',
})
export type Schedule = typeof scheduleSchema.infer

/** Full task record schema - for validation of task data objects */
export const taskRecordSchema = type({
  id: 'string',
  type: taskTypeSchema,
  'params?': 'string',
  stage: taskStageSchema,
  'status?': taskStatusSchema,
  'payload?': 'string',
  'createdAt?': 'string',
  'startedAt?': 'string',
  'completedAt?': 'string',
  'duration?': 'number',
})
export type TaskRecord = typeof taskRecordSchema.infer

// ============================================================================
// Log schemas and parsing using ArkType pipe + arkregex
// ============================================================================

/** Log line schema - single parsed log entry */
export const logLineSchema = type({
  timestamp: 'string',
  src: 'string',
  content: 'string',
})
export type LogLine = typeof logLineSchema.infer

/** Log record schema - parsed device log with multiple lines */
export const logRecordSchema = type({
  timestamp: 'string',
  title: 'string',
  lines: logLineSchema.array(),
})
export type LogRecord = typeof logRecordSchema.infer

/**
 * Type-safe regex patterns using arkregex where possible.
 *
 * Note: arkregex provides compile-time type inference for capture groups,
 * but has limitations with certain escape sequences (like `\n` in string form).
 * For complex patterns with newlines, we fall back to native RegExp with
 * named capture groups for runtime safety.
 */
const mainTimestampPattern = regex(
  '^(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2}) (?<hour>\\d{2}):(?<minute>\\d{2}):(?<second>\\d{2})',
)

// Complex pattern with newline matching requires native RegExp literal
// (arkregex doesn't support \n in string patterns)
const logLineRegex =
  /\[(?<month>\d{2})-(?<day>\d{2})\s+(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})\]\[(?<src>[^\]]+)\](?<content>[^\n]*(?:\n(?!\[)[^\n]*)*)/g

/**
 * Parse MAA device log format into structured LogRecord using ArkType morph.
 * Format: "YYYY-MM-DD HH:mm:ss|title|content"
 * Content format: "[MM-DD  HH:mm:ss][Source]Message"
 *
 * Uses arkregex for type-safe regex pattern matching where applicable.
 */
export const parseDeviceLog = type('string').pipe((str): LogRecord => {
  const [timestampStr, title, content] = str.split('|', 3)

  // Parse main timestamp using type-safe regex
  const match = mainTimestampPattern.exec(timestampStr || '')
  if (!match?.groups) {
    return { timestamp: new Date().toISOString(), title: title || '', lines: [] }
  }

  const { year, month, day, hour, minute, second } = match.groups
  const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`

  // Parse structured log lines from content
  const lines: LogLine[] = []

  // Reset regex state for global matching
  logLineRegex.lastIndex = 0
  let lineMatch
  while ((lineMatch = logLineRegex.exec(content || '')) !== null) {
    const groups = lineMatch.groups
    if (!groups) continue

    // Determine year based on main timestamp
    const lineMonth = parseInt(groups.month)
    const lineDay = parseInt(groups.day)
    const mainMonth = parseInt(month)
    const mainDay = parseInt(day)

    let lineYear = parseInt(year)
    if (lineMonth > mainMonth || (lineMonth === mainMonth && lineDay > mainDay)) {
      lineYear -= 1
    }

    const lineTimestamp = `${lineYear}-${groups.month.padStart(2, '0')}-${groups.day.padStart(2, '0')}T${groups.hour.padStart(2, '0')}:${groups.minute.padStart(2, '0')}:${groups.second.padStart(2, '0')}`

    lines.push({
      timestamp: lineTimestamp,
      src: groups.src.trim(),
      content: groups.content.trim(),
    })
  }

  return { timestamp, title: title || '', lines }
})
