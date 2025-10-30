import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Task history table - stores all task executions
 */
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  stage: text('stage').notNull(),
  status: text('status'),
  params: text('params'),
  payload: text('payload'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  duration: integer('duration'),
  device: text('device').notNull(),
})

/**
 * Schedule table - stores recurring task schedules
 */
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  hour: integer('hour').notNull(),
  minute: integer('minute').notNull().default(0),
  params: text('params'),
  timezone: text('timezone'),
  lastRunTime: text('last_run_time'),
  runCount: integer('run_count').notNull().default(0),
  device: text('device').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Manager state table - stores manager configuration and state
 */
export const managerState = sqliteTable('manager_state', {
  device: text('device').primaryKey(),
  user: text('user').notNull(),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  timezone: text('timezone').notNull(),
  lastHeartbeat: text('last_heartbeat'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Device logs table - stores device log entries
 */
export const deviceLogs = sqliteTable('device_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  device: text('device').notNull(),
  timestamp: text('timestamp').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})
