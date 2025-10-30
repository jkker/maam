# Database Persistence with Drizzle ORM

This document describes the database persistence layer implemented for MAA Manager using SQLite and Drizzle ORM.

## Overview

MAA Manager now persists all operational data to a SQLite database, including:

- **Task History**: All task executions with full lifecycle metadata
- **Schedules**: Recurring task schedules with execution tracking
- **Manager State**: Device configuration and lock state
- **Device Logs**: Historical device logs for debugging

The persistence layer ensures that MAA Manager can:

- Survive restarts without losing state
- Provide historical data for analysis
- Restore schedules automatically on startup
- Track long-term task execution patterns

## Database Schema

### Tasks Table

Stores all task executions (excluding immediate tasks like `HeartBeat`).

| Column       | Type             | Description                                                   |
| ------------ | ---------------- | ------------------------------------------------------------- |
| id           | TEXT PRIMARY KEY | Unique task identifier (format: `TaskType\|ISO8601timestamp`) |
| type         | TEXT NOT NULL    | Task type (e.g., `LinkStart`, `CaptureImage`)                 |
| stage        | TEXT NOT NULL    | Current stage: `PENDING`, `RUNNING`, or `DONE`                |
| status       | TEXT             | Final status: `SUCCESS` or `FAILED` (null if not done)        |
| params       | TEXT             | Optional task parameters                                      |
| payload      | TEXT             | Task result payload (e.g., base64 screenshot)                 |
| created_at   | TEXT NOT NULL    | ISO 8601 timestamp when task was created                      |
| started_at   | TEXT             | ISO 8601 timestamp when task started execution                |
| completed_at | TEXT             | ISO 8601 timestamp when task completed                        |
| duration     | INTEGER          | Execution duration in milliseconds                            |
| device       | TEXT NOT NULL    | Device identifier                                             |

**Indexes:**

- `idx_tasks_device` on `device`
- `idx_tasks_created_at` on `created_at`

### Schedules Table

Stores recurring task schedules.

| Column        | Type             | Description                                           |
| ------------- | ---------------- | ----------------------------------------------------- |
| id            | TEXT PRIMARY KEY | Schedule identifier (format: `TaskType\|hour:minute`) |
| type          | TEXT NOT NULL    | Task type to execute                                  |
| hour          | INTEGER NOT NULL | Hour (0-23) when task should run                      |
| minute        | INTEGER NOT NULL | Minute (0-59) when task should run (default: 0)       |
| params        | TEXT             | Optional task parameters                              |
| timezone      | TEXT             | IANA timezone for schedule execution                  |
| last_run_time | TEXT             | ISO 8601 timestamp of last execution                  |
| run_count     | INTEGER NOT NULL | Total number of executions (default: 0)               |
| device        | TEXT NOT NULL    | Device identifier                                     |
| created_at    | TEXT NOT NULL    | When schedule was created                             |

**Indexes:**

- `idx_schedules_device` on `device`

### Manager State Table

Stores manager configuration and runtime state.

| Column         | Type             | Description                           |
| -------------- | ---------------- | ------------------------------------- |
| device         | TEXT PRIMARY KEY | Device identifier                     |
| user           | TEXT NOT NULL    | Authorized user                       |
| locked         | INTEGER NOT NULL | Lock state (0 = unlocked, 1 = locked) |
| timezone       | TEXT NOT NULL    | IANA timezone for this manager        |
| last_heartbeat | TEXT             | ISO 8601 timestamp of last heartbeat  |
| updated_at     | TEXT NOT NULL    | When state was last updated           |

### Device Logs Table

Stores device log entries.

| Column     | Type                              | Description                    |
| ---------- | --------------------------------- | ------------------------------ |
| id         | INTEGER PRIMARY KEY AUTOINCREMENT | Auto-incrementing log entry ID |
| device     | TEXT NOT NULL                     | Device identifier              |
| timestamp  | TEXT NOT NULL                     | Log entry timestamp            |
| title      | TEXT NOT NULL                     | Log entry title                |
| content    | TEXT NOT NULL                     | Log entry content              |
| created_at | TEXT NOT NULL                     | When log was saved to database |

**Indexes:**

- `idx_device_logs_device` on `device`
- `idx_device_logs_timestamp` on `timestamp`

## Database Location

The database file is stored at:

- **Default**: `server/data/maam.db`
- **Custom**: Set via `DATABASE_PATH` environment variable

Example:

```bash
export DATABASE_PATH=/path/to/custom/location/maam.db
pnpm start
```

### WAL Mode

The database uses Write-Ahead Logging (WAL) mode for:

- Better concurrent read/write performance
- Reduced blocking during writes
- Crash recovery support

This creates additional files:

- `maam.db` - Main database
- `maam.db-wal` - Write-ahead log
- `maam.db-shm` - Shared memory file

## Automatic State Recovery

When MAA Manager starts, it automatically:

1. **Initializes database** tables if they don't exist
2. **Saves manager state** (device, user, timezone, lock state)
3. **Restores schedules** from database
   - Recreates cron jobs for all saved schedules
   - Restores execution metadata (lastRunTime, runCount)
4. **Resumes operations** where it left off

This ensures seamless recovery after restarts, crashes, or deployments.

## Testing

Comprehensive test suite ensures database reliability:

### Test Coverage

- **Database Service Tests** (11 tests): Task, schedule, state, and log CRUD operations
- **Integration Tests** (17 tests): Full lifecycle with MAA device simulation
- **Total**: 28 tests, all passing ✓

### MAA Device Fixture

The test suite includes a comprehensive MAA device fixture (`MaaDeviceFixture`) that simulates:

- Automatic task polling from manager
- Task execution with realistic delays
- Status reporting (SUCCESS/FAILED with 90% success rate)
- Screenshot payload generation
- Device log transmission
- Complete workflow simulations

Example usage:

```typescript
import { createTestManager } from './test/fixture'

const { manager, fixture } = createTestManager()
fixture.startPolling()

const task = manager.create('LinkStart')
await fixture.waitForTask(task.id)

expect(task.stage).toBe('DONE')
```

Run tests:

```bash
pnpm test       # Run once
pnpm test:watch # Watch mode
```

## Migration Guide

### For Existing Deployments

If you're upgrading from a version without database persistence:

1. **Stop the server**

   ```bash
   # If using systemd
   sudo systemctl stop maam
   ```

2. **Update code**

   ```bash
   git pull
   pnpm install
   pnpm build
   ```

3. **Database auto-initializes on first start**

   ```bash
   pnpm start
   ```

4. **Schedules restored automatically**

   Existing schedules in `server/src/index.ts` will be restored and saved to the database on first start.

## Backup and Recovery

### Backup

Simply copy the database file:

```bash
# While server is running (WAL mode handles this safely)
cp server/data/maam.db /backup/location/

# Or stop server first for consistent backup
sudo systemctl stop maam
cp -r server/data/ /backup/location/
sudo systemctl start maam
```

### Recovery

Restore from backup:

```bash
sudo systemctl stop maam
cp /backup/location/maam.db server/data/
sudo systemctl start maam
```

## Architecture Benefits

### State Persistence

- Tasks, schedules, and manager state survive restarts
- Historical data available for analytics
- Automatic recovery on failure

### Test Coverage

- 28 comprehensive tests covering all database operations
- MAA device fixture simulates real protocol interactions
- Test isolation with unique database files per test

### Performance

- WAL mode for concurrent read/write
- Indexed queries for fast lookups
- Async operations prevent event loop blocking
- Connection reuse via Drizzle ORM

### Type Safety

- Drizzle ORM provides full TypeScript types
- Schema validation with Zod
- Type-safe database queries
- Auto-completion for all operations

## Future Enhancements

Potential improvements:

- [ ] Automatic database cleanup/archival
- [ ] Data export to CSV/JSON
- [ ] Database migration system (drizzle-kit)
- [ ] Analytics dashboard using historical data
- [ ] Multi-device support
- [ ] Read replicas for analytics
