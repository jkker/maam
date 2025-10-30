# Testing Guide

This document describes the comprehensive test infrastructure for MAA Manager.

## Overview

MAA Manager has a complete test suite covering:

- **Database Operations** (11 tests): CRUD operations for tasks, schedules, state, and logs
- **Integration Tests** (17 tests): Full MaaManager lifecycle with simulated MAA device
- **Total Coverage**: 28 tests, all passing ✓

## Test Stack

- **Vitest**: Fast unit test framework with TypeScript support
- **Better-SQLite3**: Native SQLite bindings for database tests
- **MAA Device Fixture**: Custom fixture simulating complete MAA client behavior

## Running Tests

```bash
# Run all tests once
pnpm test

# Watch mode (auto-rerun on changes)
pnpm test:watch

# Run with coverage
pnpm test --coverage
```

## Test Structure

### Database Service Tests (`server/src/test/db.test.ts`)

Tests the database service layer in isolation:

```typescript
describe('Database Service', () => {
  describe('Task Operations', () => {
    it('should save and retrieve a task')
    it('should update a task')
    it('should retrieve tasks by device')
  })

  describe('Schedule Operations', () => {
    it('should save and retrieve a schedule')
    it('should update a schedule')
    it('should delete a schedule')
  })

  describe('Manager State Operations', () => {
    it('should save and retrieve manager state')
    it('should update manager lock state')
    it('should update manager heartbeat')
  })

  describe('Device Log Operations', () => {
    it('should save and retrieve device logs')
    it('should limit retrieved logs')
  })
})
```

### Integration Tests (`server/src/test/manager.test.ts`)

Tests MaaManager with database persistence and device simulation:

```typescript
describe('MaaManager with Device Fixture', () => {
  describe('Task Lifecycle', () => {
    it('should create and complete a task')
    it('should handle immediate tasks')
    it('should persist task to database')
    it('should update task in database on completion')
  })

  describe('Schedule Management', () => {
    it('should add and persist a schedule')
    it('should remove and delete a schedule')
  })

  describe('Lock/Unlock Operations', () => {
    it('should lock manager and persist state')
    it('should unlock manager and persist state')
    it('should prevent queued tasks when locked')
    it('should allow immediate tasks when locked')
  })

  describe('Device Logs', () => {
    it('should save device logs to database')
  })

  describe('Complete Workflow Simulation', () => {
    it('should handle a complete MAA workflow')
    it('should restore schedules from database on restart')
  })

  describe('Error Handling', () => {
    it('should handle task timeout')
    it('should handle reporting status for non-existent task')
  })

  describe('Screenshot Polling', () => {
    it('should emit screenshot events')
  })

  describe('State Management', () => {
    it('should return correct manager state')
  })
})
```

## MAA Device Fixture

The `MaaDeviceFixture` class simulates a complete MAA client:

### Features

- **Automatic Polling**: Simulates MAA client polling for tasks
- **Task Execution**: Realistic execution delays based on task type
- **Status Reporting**: 90% success rate simulation
- **Payload Generation**: Creates realistic payloads (screenshots, heartbeat responses)
- **Device Logs**: Sends formatted log messages
- **Workflow Simulation**: Complete end-to-end workflows

### Usage

```typescript
import { createTestManager } from './test/fixture'

// Create manager with fixture
const { manager, fixture } = createTestManager('test-device', 'test-user')

// Start automatic polling
fixture.startPolling()

// Create a task
const task = manager.create('LinkStart')

// Wait for task to complete
const completedTask = await fixture.waitForTask(task.id, 2000)

// Verify completion
expect(completedTask?.stage).toBe('DONE')
expect(completedTask?.status).toBeDefined()

// Clean up
fixture.stopPolling()
```

### Advanced Usage

```typescript
// Manual polling (no auto-poll)
const { manager, fixture } = createTestManager()

// Poll for tasks
const tasks = await fixture.pollTasks()

// Process tasks manually
await fixture.processNextTask()

// Report status
await fixture.reportStatus(taskId, 'SUCCESS', payload)

// Send device logs
await fixture.sendLog('[10-26 03:15:00][MAA] Task started')

// Wait for all tasks to complete
await fixture.waitForAllTasks(10000)

// Simulate complete workflow
await fixture.simulateWorkflow()
```

### Fixture Configuration

```typescript
class MaaDeviceFixture {
  constructor(
    manager: MaaManager,
    autoPolling = true, // Auto-start polling
    pollIntervalMs = 100, // Polling frequency
  )
}
```

### Task Execution Times

The fixture simulates realistic execution times:

| Task Type                | Execution Time |
| ------------------------ | -------------- |
| HeartBeat                | 10ms           |
| StopTask                 | 50ms           |
| CaptureImageNow          | 100ms          |
| CaptureImage             | 100ms          |
| LinkStart (all variants) | 200ms          |

### Payload Generation

#### Screenshots

```typescript
// CaptureImageNow and CaptureImage return base64 PNG
payload: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
```

#### HeartBeat

```typescript
// Returns empty string (no task running) or task ID (task running)
payload: '' // 80% chance
payload: 'LinkStart|2025-10-26T03:15:00Z' // 20% chance
```

## Test Isolation

Each test uses a unique database file to ensure complete isolation:

```typescript
beforeEach(() => {
  // Unique database per test
  const testDbPath = `/tmp/test-maam-${Date.now()}.db`
  process.env.DATABASE_PATH = testDbPath

  // Clean and initialize
  initDatabase()
})

afterEach(() => {
  // Close connection
  closeDatabase()

  // Remove test database
  fs.unlinkSync(testDbPath)
})
```

## Writing New Tests

### Database Service Test

```typescript
it('should perform database operation', async () => {
  // Arrange
  const testData = {
    /* ... */
  }

  // Act
  await dbService.saveTask(testData, device)

  // Assert
  const result = await dbService.getTaskById(testData.id)
  expect(result).toBeDefined()
  expect(result?.id).toBe(testData.id)
})
```

### Integration Test with Fixture

```typescript
it('should test manager behavior', async () => {
  // Start fixture polling
  fixture.startPolling()

  // Create task
  const task = manager.create('LinkStart')

  // Wait for completion
  await fixture.waitForTask(task.id, 2000)

  // Assert behavior
  expect(task.stage).toBe('DONE')

  // Wait for database persistence
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Assert persistence
  const savedTask = await dbService.getTaskById(task.id)
  expect(savedTask).toBeDefined()

  // Clean up
  fixture.stopPolling()
})
```

## Common Patterns

### Testing Async Operations

```typescript
// Wait for async database saves
await new Promise((resolve) => setTimeout(resolve, 200))
```

### Testing Lock Operations

```typescript
it('should handle locked state', async () => {
  fixture.startPolling()

  // Lock manager
  await manager.lock()

  // Verify immediate tasks still work
  const heartbeat = manager.create('HeartBeat')
  expect(heartbeat).toBeDefined()

  // Verify queued tasks are blocked
  expect(() => manager.create('LinkStart')).toThrow('Manager locked')

  fixture.stopPolling()
})
```

### Testing Complete Workflows

```typescript
it('should handle complete workflow', async () => {
  fixture.startPolling()

  // Create multiple tasks
  const tasks = [
    manager.create('HeartBeat'),
    manager.create('LinkStart'),
    manager.create('CaptureImage'),
  ]

  // Wait for all to complete
  await Promise.all(tasks.map((t) => fixture.waitForTask(t.id)))

  // Send logs
  fixture.sendLog('[MAA] Workflow complete')

  fixture.stopPolling()

  // Verify database persistence
  await new Promise((resolve) => setTimeout(resolve, 200))
  const savedTasks = await dbService.getTasksByDevice('test-device')
  expect(savedTasks.length).toBeGreaterThanOrEqual(2) // Excludes immediate tasks
})
```

## Debugging Tests

### Enable Verbose Logging

```typescript
import { DEBUG } from '../lib/logger'
// Set DEBUG environment variable before running tests
```

### Inspect Database State

```typescript
it('should verify database state', async () => {
  // Perform operations
  await dbService.saveTask(taskData, device)

  // Inspect database directly
  const allTasks = await db.select().from(tasks)
  console.log('All tasks:', allTasks)

  // Useful for debugging unexpected test failures
})
```

### Check Fixture State

```typescript
it('should verify fixture state', async () => {
  fixture.startPolling()

  // Log internal state
  console.log('Queue length:', fixture['taskQueue'].length)
  console.log('Current task:', fixture['currentTask'])

  fixture.stopPolling()
})
```

## Continuous Integration

Tests run automatically in CI:

```bash
# CI pipeline runs
pnpm ci

# Which includes:
pnpm build      # Build all packages
pnpm lint       # ESLint checks
pnpm typecheck  # TypeScript type checking
pnpm test       # Run all tests
```

## Test Metrics

Current test coverage:

- **Test Files**: 2
- **Total Tests**: 28
- **Pass Rate**: 100%
- **Execution Time**: ~8 seconds
- **Database Tests**: 11 (39%)
- **Integration Tests**: 17 (61%)

## Best Practices

1. **Test Isolation**: Always use unique database files
2. **Cleanup**: Always close connections and delete test databases
3. **Timing**: Wait for async operations (200ms typically sufficient)
4. **Fixtures**: Use `MaaDeviceFixture` for realistic MAA client simulation
5. **Assertions**: Be specific and comprehensive
6. **Error Cases**: Test both success and failure scenarios
7. **Edge Cases**: Test boundary conditions and error handling

## Troubleshooting

### Test Failures

If tests fail:

1. **Check database isolation**: Ensure unique database paths
2. **Check timing**: Increase wait times for async operations
3. **Check cleanup**: Verify `afterEach` runs properly
4. **Check fixture state**: Ensure polling is started/stopped correctly

### Database Lock Errors

```typescript
// Ensure database is closed before deleting
closeDatabase()
await new Promise((resolve) => setTimeout(resolve, 50))
fs.unlinkSync(testDbPath)
```

### Flaky Tests

Increase timeouts and wait times:

```typescript
// Increase task wait timeout
await fixture.waitForTask(task.id, 5000) // 5 seconds

// Increase database persistence wait
await new Promise((resolve) => setTimeout(resolve, 500))
```

## Future Test Enhancements

- [ ] Performance benchmarks
- [ ] Load testing with multiple concurrent devices
- [ ] Stress testing with thousands of tasks
- [ ] Database migration tests
- [ ] Screenshot quality validation
- [ ] Log parsing accuracy tests
- [ ] Network failure simulation
- [ ] Recovery from crashes
