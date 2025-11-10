/**
 * Database migration utilities using Drizzle ORM
 *
 * Run migrations programmatically in production or testing
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { logger } from '../logger'

import { db } from '.'

/**
 * Apply all pending migrations to the database
 *
 * Reads migration files from the drizzle folder and applies them in order.
 * This is idempotent - it will only apply migrations that haven't been applied yet.
 */
export function runMigrations() {
  try {
    // Try different possible paths for migrations folder
    const possiblePaths = [
      resolve('drizzle'), // When running from server directory
      resolve('server/drizzle'), // When running from workspace root
      resolve('../../../drizzle'), // Relative to this file
    ]

    const migrationsFolder = possiblePaths.find((path) => {
      const metaPath = resolve(path, 'meta/_journal.json')
      return existsSync(metaPath)
    })

    if (!migrationsFolder) {
      throw new Error(`Could not find migrations folder. Tried: ${possiblePaths.join(', ')}`)
    }

    logger.info(`Applying migrations from: ${migrationsFolder}`)

    migrate(db, { migrationsFolder })

    logger.info('Migrations applied successfully')
  } catch (error) {
    logger.error('Failed to apply migrations:', error)
    throw error
  }
}
