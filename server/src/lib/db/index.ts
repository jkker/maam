import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'
import { logger } from '../logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let currentDbPath: string | null = null
let sqlite: Database.Database | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

function getDbPath() {
  return process.env.DATABASE_PATH || path.join(__dirname, '../../../data/maam.db')
}

function ensureDbDir(dbPath: string) {
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
}

function getDatabase() {
  const dbPath = getDbPath()
  
  // Reinitialize if path changed
  if (currentDbPath !== dbPath && sqlite) {
    sqlite.close()
    sqlite = null
    dbInstance = null
  }
  
  if (!sqlite) {
    currentDbPath = dbPath
    ensureDbDir(dbPath)
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
    currentDbPath = null
  }
}

/**
 * Initialize database tables if they don't exist
 */
export function initDatabase() {
  const db = getDatabase()
  
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
    
    CREATE INDEX IF NOT EXISTS idx_tasks_device ON tasks(device);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_schedules_device ON schedules(device);
    CREATE INDEX IF NOT EXISTS idx_device_logs_device ON device_logs(device);
    CREATE INDEX IF NOT EXISTS idx_device_logs_timestamp ON device_logs(timestamp);
  `)

  logger.info('Database initialized')
}
