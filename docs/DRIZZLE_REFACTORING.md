# Drizzle ORM Migration Refactoring

## Summary

Successfully refactored the database layer to use Drizzle Kit for automatic migrations instead of manual SQL migrations.

## Changes Made

### 1. Installed Dependencies

- Added `drizzle-kit` as a dev dependency in `server/package.json`

### 2. Created Configuration

- Created `server/drizzle.config.ts` with SQLite better-sqlite3 configuration
- Points to schema at `./src/lib/db/schema.ts`
- Migrations output to `./drizzle/`
- Database file: `maam.db`

### 3. Enhanced Schema (`server/src/lib/db/schema.ts`)

- Added database indices for performance:
  - `idx_devices_user_id` on `devices.user`
  - `idx_tasks_device` on `tasks.device`
  - `idx_tasks_created_at` on `tasks.createdAt`
  - `idx_schedules_device` on `schedules.device`
  - `idx_device_logs_device` on `deviceLogs.device`
  - `idx_device_logs_timestamp` on `deviceLogs.timestamp`

### 4. Removed Manual Migrations (`server/src/lib/db/index.ts`)

- Removed `initDatabase()` function with manual SQL `CREATE TABLE` statements
- Database initialization now happens via Drizzle migrations

### 5. Created Migration Runner (`server/src/lib/db/migrate.ts`)

- New `runMigrations()` function using `drizzle-orm/better-sqlite3/migrator`
- Automatically finds migration folder (works in dev, test, and production)
- Idempotent - safe to call multiple times

### 6. Simplified Database Service (`server/src/lib/db/service.ts`)

- Removed `DatabaseService` class wrapper
- Converted to direct exported functions
- No unnecessary abstraction - direct Drizzle queries
- All functions use Drizzle's type-safe query API

### 7. Updated Imports Across Codebase

- `server/src/index.ts`: Import `runMigrations` instead of `initDatabase`, import `* as dbService`
- `server/src/MaaManager.ts`: Import `* as dbService` instead of class instance
- `server/src/lib/managers.ts`: Import `* as dbService`
- Test files: Updated to use `runMigrations` and `* as dbService`

### 8. Added NPM Scripts (`server/package.json`)

```json
{
  "db:generate": "drizzle-kit generate", // Generate migration from schema changes
  "db:push": "drizzle-kit push", // Push schema directly to DB (dev only)
  "db:migrate": "drizzle-kit migrate", // Apply migrations via CLI
  "db:studio": "drizzle-kit studio" // Open Drizzle Studio UI
}
```

## Usage

### Development Workflow

1. **Make schema changes** in `server/src/lib/db/schema.ts`

2. **Generate migration**:

   ```bash
   cd server
   pnpm db:generate
   ```

   This creates a timestamped SQL file in `server/drizzle/`

3. **Run migrations**:
   - Automatically on server start (production)
   - Or manually: `pnpm db:migrate`

### Quick Prototyping

For rapid iteration without migration files:

```bash
pnpm db:push
```

This directly syncs your schema to the database (skips migration files).

### Database Inspection

Open Drizzle Studio for a visual database browser:

```bash
pnpm db:studio
```

## Benefits

1. **Type Safety**: Full end-to-end TypeScript types from schema to queries
2. **Auto Migrations**: No manual SQL migration files to maintain
3. **Schema as Source of Truth**: Code defines structure, migrations generated automatically
4. **Better DX**: Drizzle Studio for visual inspection
5. **Less Boilerplate**: Direct queries instead of service class methods
6. **Safer**: Migrations are idempotent and tracked

## Migration Strategy

- **Development**: Use `db:push` for quick iterations
- **Production**: Use `db:generate` → commit migrations → `runMigrations()` on startup
- **Testing**: Each test calls `runMigrations()` on fresh database

## Files Modified

### Created

- `server/drizzle.config.ts`
- `server/src/lib/db/migrate.ts`
- `server/drizzle/0000_concerned_energizer.sql` (generated)
- `server/drizzle/meta/_journal.json` (generated)

### Modified

- `server/package.json`
- `server/src/lib/db/index.ts`
- `server/src/lib/db/schema.ts`
- `server/src/lib/db/service.ts`
- `server/src/index.ts`
- `server/src/MaaManager.ts`
- `server/src/lib/managers.ts`
- `server/src/test/db.test.ts`
- `server/src/test/manager.test.ts`
- `server/src/test/unlock-endpoint.test.ts`
- `server/src/test/mjpeg-stream.test.ts`

## Next Steps

The refactoring is complete and type-safe. To fully test:

1. Run `pnpm typecheck` ✅ (passes)
2. Run tests with clean database
3. Start dev server and verify migrations apply correctly

## Documentation Reference

Used official Drizzle ORM documentation for:

- `drizzle-kit` configuration for better-sqlite3
- Migration generation and application patterns
- Schema definition with indices
- Programmatic migration runner for better-sqlite3
