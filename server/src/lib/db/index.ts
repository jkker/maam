import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

export const db = drizzle('maam.db', { schema })

/**
 * Close database connection (for testing)
 */
export function closeDatabase() {}
