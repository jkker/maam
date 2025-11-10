/**
 * In-memory database for testing
 * Uses SQLite :memory: database instead of file-based storage
 */

import { resolve } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from './schema'

interface TestDbInstance {
  db: BetterSQLite3Database<typeof schema>
  close: () => void
}

/**
 * Create an ephemeral in-memory database for testing
 * Each call creates a fresh database with migrations applied
 */
export function createTestDb(): TestDbInstance {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  // Apply migrations to the in-memory database
  const migrationsFolder = resolve(__dirname, '../../../drizzle')
  migrate(db, { migrationsFolder })

  return {
    db,
    close: () => sqlite.close(),
  }
}
