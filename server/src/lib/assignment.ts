import type { LogRecord, TaskRecord } from './schema'

import munkres from 'munkres'

/**
 * Cost function parameters for task-log assignment
 */
export interface AssignmentCostParams {
  /** Weight for timestamp difference (default: 1.0) */
  timeWeight?: number
  /** Weight for duration difference (default: 0.1) */
  durationWeight?: number
  /** Maximum cost threshold - assignments above this are considered impossible (default: Infinity) */
  maxCost?: number
}

/**
 * Result of task-log assignment
 */
export interface AssignmentResult {
  /** Array of [taskIndex, logIndex] pairs representing optimal assignments */
  assignments: Array<[number, number]>
  /** Total cost of the assignment */
  totalCost: number
  /** Cost matrix used for the assignment */
  costMatrix: number[][]
}

/**
 * Parse timestamp from task record (ISO 8601 with timezone)
 * @param timestamp - ISO 8601 timestamp string like "2025-10-31T20:41:15.6+00:00[UTC]"
 * @returns Date object or null if parsing fails
 */
function parseTaskTimestamp(timestamp: string | undefined): Date | null {
  if (!timestamp) return null
  try {
    // Remove timezone name suffix like "[UTC]" if present
    const isoString = timestamp.split('[')[0]
    return new Date(isoString)
  } catch {
    return null
  }
}

/**
 * Parse timestamp from log record (Temporal PlainDateTime string)
 * Logs are assumed to be in Asia/Shanghai timezone (UTC+8)
 * @param timestamp - Temporal PlainDateTime string like "2025-10-31T13:41:44"
 * @returns Date object in UTC or null if parsing fails
 */
function parseLogTimestamp(timestamp: string | undefined): Date | null {
  if (!timestamp) return null
  try {
    // Log timestamps are in Asia/Shanghai (UTC+8)
    // Convert to UTC by adding +08:00 offset
    const dateWithTz = new Date(timestamp + '+08:00')
    return dateWithTz
  } catch {
    return null
  }
}

/**
 * Calculate duration from log record by summing reported execution time
 * @param log - Log record containing execution time in title
 * @returns Duration in milliseconds or null if not found
 */
function extractLogDuration(log: LogRecord): number | null {
  // Extract duration from title like "任务已全部完成！(用时 0h 27m 42s)"
  const match = log.title.match(/用时\s+(\d+)h\s+(\d+)m\s+(\d+)s/)
  if (!match) return null

  const [, hours, minutes, seconds] = match
  const durationMs =
    (parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10)) * 1000

  return durationMs
}

/**
 * Calculate the cost of assigning a task to a log
 * Cost is based on temporal proximity and duration similarity
 *
 * @param task - Task record with completion timestamp and duration
 * @param log - Log record with timestamp and duration
 * @param params - Cost function parameters
 * @returns Cost value (lower is better), or Infinity if assignment is impossible
 */
export function calculateAssignmentCost(
  task: TaskRecord,
  log: LogRecord,
  params: AssignmentCostParams = {},
): number {
  const { timeWeight = 1.0, durationWeight = 0.1, maxCost = Infinity } = params

  // Parse timestamps
  const taskTime = parseTaskTimestamp(task.completedAt)
  const logTime = parseLogTimestamp(log.timestamp)

  // If either timestamp is missing, assignment is impossible
  if (!taskTime || !logTime) {
    return Infinity
  }

  // Calculate time difference in milliseconds
  const timeDiff = Math.abs(taskTime.getTime() - logTime.getTime())

  // Calculate duration difference
  const taskDuration = task.duration ?? 0
  const logDuration = extractLogDuration(log) ?? 0
  const durationDiff = Math.abs(taskDuration - logDuration)

  // Weighted cost: prioritize temporal proximity over duration similarity
  const cost = timeDiff * timeWeight + durationDiff * durationWeight

  // Return infinity if cost exceeds threshold
  return cost > maxCost ? Infinity : cost
}

/**
 * Create a cost matrix for task-log assignment
 * Matrix dimensions: [tasks.length, logs.length]
 *
 * @param tasks - Array of task records
 * @param logs - Array of log records
 * @param params - Cost function parameters
 * @returns Cost matrix where costMatrix[i][j] is the cost of assigning task i to log j
 */
export function createCostMatrix(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params: AssignmentCostParams = {},
): number[][] {
  const matrix: number[][] = []

  for (let i = 0; i < tasks.length; i++) {
    const row: number[] = []
    for (let j = 0; j < logs.length; j++) {
      row.push(calculateAssignmentCost(tasks[i], logs[j], params))
    }
    matrix.push(row)
  }

  return matrix
}

/**
 * Solve the unbalanced assignment problem using the Hungarian Algorithm (Munkres)
 * Finds the optimal assignment of tasks to logs that minimizes total cost
 *
 * For unbalanced problems:
 * - If tasks > logs: Some tasks will not be assigned to any log
 * - If logs > tasks: Some logs will not be assigned to any task
 *
 * @param tasks - Array of task records
 * @param logs - Array of log records
 * @param params - Cost function parameters
 * @returns Assignment result with optimal task-log pairs
 */
export function solveAssignment(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params: AssignmentCostParams = {},
): AssignmentResult {
  // Handle empty inputs
  if (tasks.length === 0 || logs.length === 0) {
    return {
      assignments: [],
      totalCost: 0,
      costMatrix: [],
    }
  }

  // Create cost matrix
  const costMatrix = createCostMatrix(tasks, logs, params)

  // Make matrix square by padding with high-cost dummy rows/columns
  const maxDim = Math.max(tasks.length, logs.length)
  const squareMatrix: number[][] = []

  for (let i = 0; i < maxDim; i++) {
    const row: number[] = []
    for (let j = 0; j < maxDim; j++) {
      if (i < tasks.length && j < logs.length) {
        row.push(costMatrix[i][j])
      } else {
        // Use a very high cost for dummy assignments
        row.push(Infinity)
      }
    }
    squareMatrix.push(row)
  }

  // Solve using Hungarian algorithm
  const indices = munkres(squareMatrix)

  // Filter out dummy assignments and infinite cost assignments
  const assignments: Array<[number, number]> = []
  let totalCost = 0

  for (const [taskIdx, logIdx] of indices) {
    // Skip dummy assignments (outside original matrix bounds)
    if (taskIdx >= tasks.length || logIdx >= logs.length) {
      continue
    }

    const cost = costMatrix[taskIdx][logIdx]

    // Skip assignments with infinite cost (impossible matches)
    if (!isFinite(cost)) {
      continue
    }

    assignments.push([taskIdx, logIdx])
    totalCost += cost
  }

  return {
    assignments,
    totalCost,
    costMatrix,
  }
}

/**
 * Assign logs to tasks based on optimal matching
 * Returns a map of task IDs to their assigned log records
 *
 * @param tasks - Array of task records
 * @param logs - Array of log records
 * @param params - Cost function parameters
 * @returns Map of task ID to assigned log record
 */
export function assignLogsToTasks(
  tasks: TaskRecord[],
  logs: LogRecord[],
  params: AssignmentCostParams = {},
): Map<string, LogRecord> {
  const result = solveAssignment(tasks, logs, params)
  const assignmentMap = new Map<string, LogRecord>()

  for (const [taskIdx, logIdx] of result.assignments) {
    const task = tasks[taskIdx]
    const log = logs[logIdx]
    if (task && log) {
      assignmentMap.set(task.id, log)
    }
  }

  return assignmentMap
}
