# Assignment Solver Implementation Summary

## Problem Statement

Implement an optimal assignment solver between tasks and logs using a Min-Cost Max-Flow (MCMF) algorithm or Hungarian Algorithm. This is an "unbalanced assignment problem" where there may exist tasks without logs and logs without tasks.

## Solution Implemented

✅ **Hungarian Algorithm** (Munkres algorithm) - chosen for optimal O(n³) performance

## Key Features

### 1. Optimal Assignment

- Uses the Munkres implementation for finding minimum cost perfect matching
- Handles unbalanced problems (different number of tasks vs logs)
- Guarantees optimal solution (minimal total cost)

### 2. Cost Function

The cost of assigning a task to a log is calculated as:

```typescript
cost = timeDiff × timeWeight + durationDiff × durationWeight
```

**Default weights:**

- `timeWeight = 1.0` - Prioritizes temporal proximity
- `durationWeight = 0.1` - Secondary consideration for duration matching

### 3. Timezone Handling

- **Task timestamps**: UTC timezone (ISO 8601 format)
- **Log timestamps**: Asia/Shanghai timezone (UTC+8)
- Automatic conversion ensures accurate time comparison

### 4. Unbalanced Assignment Support

- Pads cost matrix to square dimensions with `Infinity` costs
- Filters out dummy assignments after solving
- Returns only valid, finite-cost assignments

## Implementation Details

### Files Created

1. **`server/src/lib/assignment.ts`** (250+ lines)
   - Core algorithm implementation
   - Cost calculation functions
   - Matrix creation and solving
   - Public API exports

2. **`server/src/test/assignment.test.ts`** (400+ lines)
   - 15 comprehensive unit tests
   - Tests for all public API functions
   - Edge case coverage
   - Real-world scenario testing

3. **`server/src/lib/ASSIGNMENT.md`** (300+ lines)
   - Detailed documentation
   - API reference
   - Usage examples
   - Implementation notes

4. **`docs/assignment-example.ts`**
   - Example usage with state.example.json
   - Demonstrates both simple and advanced usage

### Dependencies Added

```json
{
  "munkres": "^2.0.4" // Hungarian algorithm implementation
}
```

### Public API

```typescript
// High-level API - returns Map of task IDs to logs
export function assignLogsToTasks(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params?: AssignmentCostParams,
): Map<string, LogRecord>

// Detailed API - returns full assignment details
export function solveAssignment(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params?: AssignmentCostParams,
): AssignmentResult

// Cost calculation
export function calculateAssignmentCost(
  task: TaskRecord,
  log: LogRecord,
  params?: AssignmentCostParams,
): number

// Matrix generation
export function createCostMatrix(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params?: AssignmentCostParams,
): number[][]
```

### Configuration Options

```typescript
interface AssignmentCostParams {
  timeWeight?: number // Default: 1.0
  durationWeight?: number // Default: 0.1
  maxCost?: number // Default: Infinity
}
```

## Test Results

✅ **All 15 tests passing**

- Cost calculation with various parameters
- Cost matrix creation
- Balanced assignment (equal tasks and logs)
- Unbalanced assignment (more tasks than logs)
- Unbalanced assignment (more logs than tasks)
- Empty input handling
- Missing timestamp handling
- Real-world scenario from state.example.json

```
✓ server/src/test/assignment.test.ts (15 tests) 9ms

Test Files  1 passed (1)
     Tests  15 passed (15)
```

## Algorithm Complexity

- **Cost matrix creation**: O(n × m) where n = tasks, m = logs
- **Hungarian algorithm**: O(max(n,m)³)
- **Total**: O(max(n,m)³)

For typical use cases:

- 100 tasks × 100 logs: ~1,000,000 operations
- 500 tasks × 500 logs: ~125,000,000 operations

## Example Usage

```typescript
import { assignLogsToTasks } from '@maam/server'
import type { TaskRecord, LogRecord } from '@maam/server'

const tasks: TaskRecord[] = [
  /* ... */
]
const logs: LogRecord[] = [
  /* ... */
]

// Simple usage
const assignmentMap = assignLogsToTasks(tasks, logs)

for (const [taskId, log] of assignmentMap) {
  console.log(`Task ${taskId} -> Log at ${log.timestamp}`)
}

// Advanced usage with custom parameters
const result = solveAssignment(tasks, logs, {
  timeWeight: 2.0, // Double weight on time proximity
  durationWeight: 0.5, // More weight on duration
  maxCost: 3600000, // Max 1 hour difference
})

console.log(`Assignments: ${result.assignments.length}`)
console.log(`Total cost: ${result.totalCost}`)
```

## Integration Points

The assignment solver is:

- ✅ Exported from `@maam/server` package
- ✅ Type-safe with TypeScript
- ✅ Documented with JSDoc comments
- ✅ Tested with comprehensive unit tests
- ✅ Ready for integration into MaaManager
- ✅ Ready for tRPC endpoint exposure (optional)

## Future Enhancements

Potential improvements (not required for initial implementation):

1. **Content-based matching**: Parse log content to identify task types
2. **Fuzzy matching**: Allow approximate matches with confidence scores
3. **Historical learning**: Use past assignments to improve future matching
4. **Multi-objective optimization**: Balance multiple criteria simultaneously
5. **Incremental updates**: Efficiently update assignments as new data arrives

## Verification

All quality checks pass:

- ✅ Type checking (`pnpm typecheck`)
- ✅ Unit tests (`pnpm test`)
- ✅ Linting (`pnpm lint`)
- ✅ Build (`pnpm build`)

## Documentation

Complete documentation available in:

- `server/src/lib/ASSIGNMENT.md` - Detailed technical documentation
- `README.md` - Feature overview in main README
- `docs/assignment-example.ts` - Usage examples
- Inline JSDoc comments in source code

## Conclusion

The assignment solver successfully addresses the problem statement:

- ✅ Implements optimal assignment algorithm (Hungarian/Munkres)
- ✅ Handles unbalanced assignment problems
- ✅ Provides configurable cost function
- ✅ Includes comprehensive testing
- ✅ Fully documented and production-ready
