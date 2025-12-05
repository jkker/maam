/**
 * Schema definitions using ArkType - Single Source of Truth
 *
 * All validation schemas and types are defined here using ArkType.
 * Types are derived directly from schemas, not declared separately.
 *
 * @see https://arktype.io/docs/scopes
 */
import { type } from 'arktype'
import { createSelectSchema, createInsertSchema } from 'drizzle-arktype'

import { IMMEDIATE_TASK, TASK_TYPE } from '../const'
import * as dbSchema from './db/schema'

// ============================================================================
// Core enumerated types - Single Source of Truth from const.ts
// ============================================================================

/** Task type schema - validates against TASK_TYPE constant */
export const taskTypeSchema = type.enumerated(...TASK_TYPE)
export type TaskType = typeof taskTypeSchema.infer

/** Immediate task schema - validates against IMMEDIATE_TASK constant */
export const immediateTaskSchema = type.enumerated(...IMMEDIATE_TASK)
export type ImmediateTask = typeof immediateTaskSchema.infer

/** Task stage schema */
export const taskStageSchema = type("'PENDING' | 'RUNNING' | 'DONE'")
export type TaskStage = typeof taskStageSchema.infer

/** Task status schema (includes CANCELLED for internal use) */
export const taskStatusSchema = type("'PENDING' | 'FAILED' | 'SUCCESS' | 'CANCELLED'")
export type TaskStatus = typeof taskStatusSchema.infer

/** Report status schema - subset for MAA client reports */
export const reportStatusSchema = type("'FAILED' | 'SUCCESS'")
export type ReportStatus = typeof reportStatusSchema.infer

// ============================================================================
// Application schemas - for validation
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

/** Schedule input schema with defaults */
export const scheduleSchema = type({
  hour: '0 <= number.integer <= 23',
  minute: type('0 <= number.integer <= 59').default(0),
  task: taskTypeSchema.default('LinkStart'),
  'params?': 'string',
  'timezone?': 'string',
})
export type Schedule = typeof scheduleSchema.infer

/** Schedule with runtime metadata (extends Schedule) */
export const scheduleWithMetadataSchema = type({
  hour: '0 <= number.integer <= 23',
  minute: '0 <= number.integer <= 59',
  task: taskTypeSchema,
  'params?': 'string',
  'timezone?': 'string',
  id: 'string',
  'lastRunTime?': 'string',
  'runCount?': 'number.integer >= 0',
  'nextRunTime?': 'string',
  'cooldownUntil?': 'string',
})
export type ScheduleWithMetadata = typeof scheduleWithMetadataSchema.infer

/** Full task record schema */
export const taskSchema = type({
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
export type TaskRecord = typeof taskSchema.infer

/** Log line schema */
export const logLineSchema = type({
  timestamp: 'string',
  src: 'string',
  content: 'string',
})
export type LogLine = typeof logLineSchema.infer

/** Log record schema */
export const logRecordSchema = type({
  timestamp: 'string',
  title: 'string',
  lines: logLineSchema.array(),
})
export type LogRecord = typeof logRecordSchema.infer

// ============================================================================
// Drizzle-ArkType schemas - infer types from database schema
// ============================================================================

/** Schema for inserting new schedules into DB */
export const scheduleInsertSchema = createInsertSchema(dbSchema.schedules)
export type ScheduleInsert = typeof scheduleInsertSchema.infer

/** Schema for selecting schedules from DB */
export const scheduleSelectSchema = createSelectSchema(dbSchema.schedules)
export type ScheduleSelect = typeof scheduleSelectSchema.infer

/** Schema for inserting tasks into DB */
export const taskInsertSchema = createInsertSchema(dbSchema.tasks)
export type TaskInsert = typeof taskInsertSchema.infer

/** Schema for selecting tasks from DB */
export const taskSelectSchema = createSelectSchema(dbSchema.tasks)
export type TaskSelect = typeof taskSelectSchema.infer

/** Schema for manager state */
export const managerStateSelectSchema = createSelectSchema(dbSchema.managerState)
export type ManagerStateSelect = typeof managerStateSelectSchema.infer

// ============================================================================
// Log parsing morphs using ArkType pipe
// ============================================================================

/**
 * Parse MAA device log format into structured LogRecord using ArkType morph.
 * Format: "YYYY-MM-DD HH:mm:ss|title|content"
 * Content format: "[MM-DD  HH:mm:ss][Source]Message"
 */
export const parseDeviceLog = type('string').pipe((str): LogRecord => {
  const [timestampStr, title, content] = str.split('|', 3)

  // Parse main timestamp: "YYYY-MM-DD HH:mm:ss"
  const match = timestampStr?.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    return { timestamp: new Date().toISOString(), title: title || '', lines: [] }
  }

  const [, year, month, day, hour, minute, second] = match
  const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`

  // Parse structured log lines from content
  const lines: LogLine[] = []
  const lineRegex =
    /\[(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\]\[([^\]]+)\]([^\n]*(?:\n(?!\[)[^\n]*)*)/g

  let lineMatch
  while ((lineMatch = lineRegex.exec(content || '')) !== null) {
    const [, monthStr, dayStr, hourStr, minuteStr, secondStr, src, contentStr] = lineMatch

    // Determine year based on main timestamp
    const lineMonth = parseInt(monthStr)
    const lineDay = parseInt(dayStr)
    const mainMonth = parseInt(month)
    const mainDay = parseInt(day)

    let lineYear = parseInt(year)
    if (lineMonth > mainMonth || (lineMonth === mainMonth && lineDay > mainDay)) {
      lineYear -= 1
    }

    const lineTimestamp = `${lineYear}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:${secondStr.padStart(2, '0')}`

    lines.push({
      timestamp: lineTimestamp,
      src: src.trim(),
      content: contentStr.trim(),
    })
  }

  return { timestamp, title: title || '', lines }
})
