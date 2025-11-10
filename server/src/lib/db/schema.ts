import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Users table - stores user information
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Devices table - stores device information linked to users
 */
export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    user: text('user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    lastSeen: text('last_seen'),
  },
  (table) => ({
    userIdx: index('idx_devices_user_id').on(table.user),
  }),
)

/**
 * Task history table - stores all task executions
 */
export const tasks = sqliteTable(
  'tasks',
  {
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
  },
  (table) => ({
    deviceIdx: index('idx_tasks_device').on(table.device),
    createdAtIdx: index('idx_tasks_created_at').on(table.createdAt),
  }),
)

/**
 * Schedule table - stores recurring task schedules
 */
export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    hour: integer('hour').notNull(),
    minute: integer('minute').notNull().default(0),
    params: text('params'),
    timezone: text('timezone'),
    lastRunTime: text('last_run_time'),
    runCount: integer('run_count').notNull().default(0),
    cooldownUntil: text('cooldown_until'),
    device: text('device').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    deviceIdx: index('idx_schedules_device').on(table.device),
  }),
)

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
export const deviceLogs = sqliteTable(
  'device_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    device: text('device').notNull(),
    timestamp: text('timestamp').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    deviceIdx: index('idx_device_logs_device').on(table.device),
    timestampIdx: index('idx_device_logs_timestamp').on(table.timestamp),
  }),
)
