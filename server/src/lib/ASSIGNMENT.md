# Task-Log Assignment Solver

## Overview

This module implements an optimal assignment solver for matching MAA tasks to their corresponding execution logs using the **Hungarian Algorithm** (also known as the Munkres algorithm).

## Problem Description

The assignment problem arises from the need to match:

- **Tasks**: MAA task records with UTC timestamps and execution durations
- **Logs**: Execution logs with local timezone timestamps (Asia/Shanghai, UTC+8) and durations

This is an **unbalanced assignment problem** where:

- Some tasks may not have corresponding logs
- Some logs may not have corresponding tasks
- We want to find the optimal 1-to-1 (or 1-to-0) matching based on a cost function

## Algorithm

The implementation uses the **Hungarian Algorithm** (Munkres algorithm) for optimal assignment with O(n³) complexity.

### Cost Function

The cost of assigning a task to a log is calculated as:

```
cost = timeDiff × timeWeight + durationDiff × durationWeight
```

Where:

- `timeDiff`: Absolute difference between task completion time and log timestamp (in milliseconds)
- `durationDiff`: Absolute difference between task duration and log duration (in milliseconds)
- `timeWeight`: Weight for temporal proximity (default: 1.0)
- `durationWeight`: Weight for duration similarity (default: 0.1)

**Note**: Time proximity is prioritized over duration similarity by default.

### Handling Unbalanced Problems

For unbalanced assignment problems (different number of tasks and logs):

1. The cost matrix is padded to create a square matrix
2. Dummy assignments are filled with `Infinity` cost
3. After solving, dummy assignments and infinite-cost assignments are filtered out
4. This allows some tasks/logs to remain unassigned

## Usage

### Basic Example

```typescript
import { assignLogsToTasks } from '@maam/server'
import type { TaskRecord, LogRecord } from '@maam/server'

const tasks: TaskRecord[] = [
  {
    id: 'LinkStart|2025-10-31T20:41:30+00:00[UTC]',
    type: 'LinkStart',
    stage: 'DONE',
    completedAt: '2025-10-31T20:41:30+00:00[UTC]',
    duration: 15000, // 15 seconds
  },
]

const logs: LogRecord[] = [
  {
    timestamp: '2025-11-01T04:41:30', // Same time in Shanghai (UTC+8)
    title: '任务已全部完成！(用时 0h 0m 15s)',
    lines: [],
  },
]

// Get assignment map: task ID -> log record
const assignmentMap = assignLogsToTasks(tasks, logs)

for (const [taskId, log] of assignmentMap) {
  console.log(`Task ${taskId} matched to log at ${log.timestamp}`)
}
```

### Advanced Example with Custom Parameters

```typescript
import { solveAssignment, type AssignmentCostParams } from '@maam/server'

const params: AssignmentCostParams = {
  timeWeight: 2.0, // Double the weight for time differences
  durationWeight: 0.5, // Increase duration importance
  maxCost: 3600000, // Max 1 hour time difference allowed
}

const result = solveAssignment(tasks, logs, params)

console.log(`Total assignments: ${result.assignments.length}`)
console.log(`Total cost: ${result.totalCost}`)

// Examine individual assignments
for (const [taskIdx, logIdx] of result.assignments) {
  const task = tasks[taskIdx]
  const log = logs[logIdx]
  const cost = result.costMatrix[taskIdx][logIdx]
  console.log(`Task ${taskIdx} -> Log ${logIdx} (cost: ${cost})`)
}
```

## API Reference

### `assignLogsToTasks(tasks, logs, params?)`

Convenience function that returns a Map of task IDs to their assigned logs.

**Parameters:**

- `tasks: TaskRecord[]` - Array of task records
- `logs: LogRecord[]` - Array of log records
- `params?: AssignmentCostParams` - Optional cost function parameters

**Returns:** `Map<string, LogRecord>` - Map of task ID to assigned log record

### `solveAssignment(tasks, logs, params?)`

Low-level function that solves the assignment problem and returns detailed results.

**Parameters:**

- `tasks: TaskRecord[]` - Array of task records
- `logs: LogRecord[]` - Array of log records
- `params?: AssignmentCostParams` - Optional cost function parameters

**Returns:** `AssignmentResult`

- `assignments: Array<[number, number]>` - Array of [taskIndex, logIndex] pairs
- `totalCost: number` - Total cost of all assignments
- `costMatrix: number[][]` - Full cost matrix used for solving

### `calculateAssignmentCost(task, log, params?)`

Calculate the cost of assigning a specific task to a specific log.

**Parameters:**

- `task: TaskRecord` - Single task record
- `log: LogRecord` - Single log record
- `params?: AssignmentCostParams` - Optional cost function parameters

**Returns:** `number` - Cost value (lower is better), or `Infinity` if impossible

### `AssignmentCostParams`

Optional parameters for customizing the cost function:

```typescript
interface AssignmentCostParams {
  timeWeight?: number // Default: 1.0
  durationWeight?: number // Default: 0.1
  maxCost?: number // Default: Infinity
}
```

## Timezone Handling

The implementation correctly handles timezone differences:

- **Task timestamps**: Expected in UTC (ISO 8601 format with timezone info)
- **Log timestamps**: Expected in Asia/Shanghai timezone (UTC+8)
- Timestamps are automatically converted to the same timezone for comparison

Example:

```
Task completed: 2025-10-31T20:41:30+00:00[UTC]
Log timestamp:  2025-11-01T04:41:30 (Shanghai)
→ Same instant in time (0 difference)
```

## Implementation Details

### Dependencies

- `munkres` - Implementation of the Hungarian algorithm for assignment problems

### Time Complexity

- **Cost matrix creation**: O(n × m) where n = tasks, m = logs
- **Hungarian algorithm**: O(max(n,m)³)
- **Total complexity**: O(max(n,m)³)

### Edge Cases Handled

1. **Empty inputs**: Returns empty assignments
2. **Missing timestamps**: Assignments with missing timestamps have `Infinity` cost
3. **Unbalanced problems**: Correctly handles when tasks ≠ logs
4. **Perfect matches**: Cost can be 0 for identical timestamps and durations
5. **Timezone differences**: Correctly converts between UTC and local time

## Testing

The module includes comprehensive unit tests covering:

- Cost calculation with various parameters
- Cost matrix creation
- Balanced and unbalanced assignment problems
- Edge cases (empty inputs, missing data)
- Real-world scenarios from `state.example.json`

Run tests with:

```bash
pnpm test src/test/assignment.test.ts
```

## Example Output

```
=== ASSIGNMENT SOLVER DEMO ===

Tasks: 6
Logs: 6

=== ASSIGNMENT RESULTS ===

Total assignments: 5
Total cost: 12345s (time difference)

=== TASK-LOG ASSIGNMENTS ===

Task 1: LinkStart
  Completed: 2025-10-31T20:41:30.611+00:00[UTC]
  Duration: 15s
  -> Assigned to Log 1
     Log timestamp: 2025-11-01T04:41:30
     Log title: 任务已全部完成！(用时 0h 0m 15s)

Task 6: LinkStart
  Completed: N/A
  Duration: 587s
  -> NO LOG ASSIGNED (task cancelled, no completion time)

=== UNASSIGNED LOGS ===

Log 3:
  Timestamp: 2025-10-31T14:20:31
  Title: 任务已全部完成！(用时 0h 8m 26s)
```

## Future Enhancements

Potential improvements for the assignment algorithm:

1. **Content-based matching**: Parse log content to match task types
2. **Fuzzy matching**: Allow approximate matches with confidence scores
3. **Historical learning**: Use past assignments to improve future matching
4. **Multi-objective optimization**: Balance multiple criteria (time, duration, content, etc.)
5. **Incremental updates**: Efficiently update assignments as new tasks/logs arrive
