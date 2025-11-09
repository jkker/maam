import { resolve } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'
import { logger } from '../logger'

let sqlite: Database.Database | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

function getDatabase() {
  const dbPath = resolve('maam.db')

  if (!sqlite) {
    logger.info(`Database path: ${dbPath}`)

    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    dbInstance = drizzle(sqlite, { schema })
  }
  return dbInstance!
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Reflect.get(getDatabase(), prop)
  },
})

/**
 * Close database connection (for testing)
 */
export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    dbInstance = null
  }
}

/**
 * Initialize database tables if they don't exist
 */
export function initDatabase() {
  getDatabase()

  sqlite!.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT,
      params TEXT,
      payload TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      duration INTEGER,
      device TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL DEFAULT 0,
      params TEXT,
      timezone TEXT,
      last_run_time TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      cooldown_until TEXT,
      device TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS manager_state (
      device TEXT PRIMARY KEY,
      user TEXT NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL,
      last_heartbeat TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS device_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_tasks_device ON tasks(device);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_schedules_device ON schedules(device);
    CREATE INDEX IF NOT EXISTS idx_device_logs_device ON device_logs(device);
    CREATE INDEX IF NOT EXISTS idx_device_logs_timestamp ON device_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
  `)

  logger.info('Database initialized')
}
