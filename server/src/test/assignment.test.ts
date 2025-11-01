import type { LogRecord, TaskRecord } from '../lib/schema'

import { describe, expect, it } from 'vitest'

import {
  assignLogsToTasks,
  calculateAssignmentCost,
  createCostMatrix,
  solveAssignment,
  type AssignmentCostParams,
} from '../lib/assignment'

describe('Assignment Solver', () => {
  describe('calculateAssignmentCost', () => {
    it('should calculate cost based on time and duration differences', () => {
      const task: TaskRecord = {
        id: 'task1',
        type: 'LinkStart',
        stage: 'DONE',
        status: 'SUCCESS',
        completedAt: '2025-10-31T20:41:30.611+00:00[UTC]',
        duration: 15000, // 15 seconds
      }

      const log: LogRecord = {
        timestamp: '2025-11-01T04:41:30', // Same time in Shanghai (UTC+8)
        title: '任务已全部完成！(用时 0h 0m 15s)',
        lines: [],
      }

      const cost = calculateAssignmentCost(task, log)

      // Time difference should be ~0, duration difference should be ~0
      expect(cost).toBeLessThan(1000) // Should be very low cost
    })

    it('should return Infinity for missing timestamps', () => {
      const task: TaskRecord = {
        id: 'task1',
        type: 'LinkStart',
        stage: 'DONE',
        completedAt: undefined, // Missing timestamp
      }

      const log: LogRecord = {
        timestamp: '2025-11-01T04:41:30',
        title: '任务已全部完成！(用时 0h 0m 15s)',
        lines: [],
      }

      const cost = calculateAssignmentCost(task, log)
      expect(cost).toBe(Infinity)
    })

    it('should respect time and duration weights', () => {
      const task: TaskRecord = {
        id: 'task1',
        type: 'LinkStart',
        stage: 'DONE',
        completedAt: '2025-10-31T20:41:30+00:00[UTC]',
        duration: 15000,
      }

      const log: LogRecord = {
        timestamp: '2025-11-01T04:42:30', // 1 minute later
        title: '任务已全部完成！(用时 0h 1m 15s)', // 60 seconds longer
        lines: [],
      }

      const params: AssignmentCostParams = {
        timeWeight: 2.0,
        durationWeight: 0.5,
      }

      const cost = calculateAssignmentCost(task, log, params)

      // Time diff = 60s = 60000ms, Duration diff = 60s = 60000ms
      // Cost = 60000 * 2.0 + 60000 * 0.5 = 120000 + 30000 = 150000
      expect(cost).toBeCloseTo(150000, -3)
    })

    it('should return Infinity when cost exceeds maxCost', () => {
      const task: TaskRecord = {
        id: 'task1',
        type: 'LinkStart',
        stage: 'DONE',
        completedAt: '2025-10-31T20:41:30+00:00[UTC]',
        duration: 15000,
      }

      const log: LogRecord = {
        timestamp: '2025-11-01T10:00:00', // Many hours later
        title: '任务已全部完成！(用时 0h 0m 15s)',
        lines: [],
      }

      const params: AssignmentCostParams = {
        maxCost: 1000000, // 1 second max
      }

      const cost = calculateAssignmentCost(task, log, params)
      expect(cost).toBe(Infinity)
    })
  })

  describe('createCostMatrix', () => {
    it('should create a cost matrix with correct dimensions', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          duration: 15000,
        },
        {
          id: 'task2',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T21:20:35+00:00[UTC]',
          duration: 514000,
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T05:20:35',
          title: '任务已全部完成！(用时 0h 8m 34s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T06:00:00',
          title: '任务已全部完成！(用时 0h 10m 0s)',
          lines: [],
        },
      ]

      const matrix = createCostMatrix(tasks, logs)

      expect(matrix).toHaveLength(2) // 2 tasks
      expect(matrix[0]).toHaveLength(3) // 3 logs
      expect(matrix[1]).toHaveLength(3)

      // All costs should be finite positive numbers or Infinity
      for (const row of matrix) {
        for (const cost of row) {
          expect(cost).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('should produce lower costs for better matches', () => {
      const task: TaskRecord = {
        id: 'task1',
        type: 'LinkStart',
        stage: 'DONE',
        completedAt: '2025-10-31T20:41:30+00:00[UTC]',
        duration: 15000,
      }

      const goodLog: LogRecord = {
        timestamp: '2025-11-01T04:41:30', // Same time
        title: '任务已全部完成！(用时 0h 0m 15s)', // Same duration
        lines: [],
      }

      const badLog: LogRecord = {
        timestamp: '2025-11-01T10:00:00', // Much later
        title: '任务已全部完成！(用时 1h 0m 0s)', // Much longer
        lines: [],
      }

      const matrix = createCostMatrix([task], [goodLog, badLog])

      expect(matrix[0][0]).toBeLessThan(matrix[0][1])
    })
  })

  describe('solveAssignment', () => {
    it('should handle balanced assignment (equal tasks and logs)', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          duration: 15000,
        },
        {
          id: 'task2',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T21:20:35+00:00[UTC]',
          duration: 514000,
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T05:20:35',
          title: '任务已全部完成！(用时 0h 8m 34s)',
          lines: [],
        },
      ]

      const result = solveAssignment(tasks, logs)

      expect(result.assignments).toHaveLength(2)
      expect(result.totalCost).toBeGreaterThanOrEqual(0) // Can be 0 for perfect matches
      expect(result.costMatrix).toHaveLength(2)

      // Should assign task1 -> log1 and task2 -> log2 (best matches)
      expect(result.assignments).toContainEqual([0, 0])
      expect(result.assignments).toContainEqual([1, 1])
    })

    it('should handle unbalanced assignment (more tasks than logs)', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          duration: 15000,
        },
        {
          id: 'task2',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T21:20:35+00:00[UTC]',
          duration: 514000,
        },
        {
          id: 'task3',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-11-01T05:24:27+00:00[UTC]',
          duration: 567000,
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T05:20:35',
          title: '任务已全部完成！(用时 0h 8m 34s)',
          lines: [],
        },
      ]

      const result = solveAssignment(tasks, logs)

      // Should assign best 2 matches, leaving 1 task unassigned
      expect(result.assignments.length).toBeLessThanOrEqual(2)
    })

    it('should handle unbalanced assignment (more logs than tasks)', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          duration: 15000,
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T05:20:35',
          title: '任务已全部完成！(用时 0h 8m 34s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T06:20:59',
          title: '任务已全部完成！(用时 0h 10m 56s)',
          lines: [],
        },
      ]

      const result = solveAssignment(tasks, logs)

      // Should assign 1 best match, leaving 2 logs unassigned
      expect(result.assignments).toHaveLength(1)
    })

    it('should return empty assignments for empty inputs', () => {
      const result1 = solveAssignment([], [])
      expect(result1.assignments).toHaveLength(0)
      expect(result1.totalCost).toBe(0)

      const result2 = solveAssignment(
        [
          {
            id: 'task1',
            type: 'LinkStart',
            stage: 'DONE',
            completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          },
        ],
        [],
      )
      expect(result2.assignments).toHaveLength(0)
    })

    it('should skip assignments with infinite cost', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: undefined, // No timestamp
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
      ]

      const result = solveAssignment(tasks, logs)

      // Should not assign because cost is infinite
      expect(result.assignments).toHaveLength(0)
    })
  })

  describe('assignLogsToTasks', () => {
    it('should return a map of task IDs to log records', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'LinkStart|2025-10-31T20:41:30+00:00[UTC]',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          duration: 15000,
        },
        {
          id: 'LinkStart|2025-10-31T21:20:35+00:00[UTC]',
          type: 'LinkStart',
          stage: 'DONE',
          completedAt: '2025-10-31T21:20:35+00:00[UTC]',
          duration: 514000,
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
        {
          timestamp: '2025-11-01T05:20:35',
          title: '任务已全部完成！(用时 0h 8m 34s)',
          lines: [],
        },
      ]

      const assignmentMap = assignLogsToTasks(tasks, logs)

      expect(assignmentMap.size).toBeGreaterThan(0)
      expect(assignmentMap.size).toBeLessThanOrEqual(Math.min(tasks.length, logs.length))

      // Check that assigned logs match expected structure
      for (const [taskId, log] of assignmentMap) {
        expect(tasks.some((t) => t.id === taskId)).toBe(true)
        expect(log).toHaveProperty('timestamp')
        expect(log).toHaveProperty('title')
        expect(log).toHaveProperty('lines')
      }
    })

    it('should return empty map for empty inputs', () => {
      const map1 = assignLogsToTasks([], [])
      expect(map1.size).toBe(0)

      const map2 = assignLogsToTasks(
        [
          {
            id: 'task1',
            type: 'LinkStart',
            stage: 'DONE',
            completedAt: '2025-10-31T20:41:30+00:00[UTC]',
          },
        ],
        [],
      )
      expect(map2.size).toBe(0)
    })

    it('should handle tasks without completed timestamps', () => {
      const tasks: TaskRecord[] = [
        {
          id: 'task1',
          type: 'LinkStart',
          stage: 'RUNNING',
          // No completedAt
        },
      ]

      const logs: LogRecord[] = [
        {
          timestamp: '2025-11-01T04:41:30',
          title: '任务已全部完成！(用时 0h 0m 15s)',
          lines: [],
        },
      ]

      const assignmentMap = assignLogsToTasks(tasks, logs)

      // Task without completion should not be assigned
      expect(assignmentMap.size).toBe(0)
    })
  })

  describe('Real-world scenario from state.example.json', () => {
    it('should correctly assign tasks to logs from example data', () => {
      // Simplified version of tasks from state.example.json
      const tasks: TaskRecord[] = [
        {
          id: 'LinkStart|2025-10-31T20:41:15.6+00:00[UTC]',
          type: 'LinkStart',
          stage: 'DONE',
          status: 'SUCCESS',
          createdAt: '2025-10-31T20:41:15.6+00:00[UTC]',
          startedAt: '2025-10-31T20:41:16.079+00:00[UTC]',
          completedAt: '2025-10-31T20:41:30.611+00:00[UTC]',
          duration: 14532,
        },
        {
          id: 'LinkStart-Recruiting|2025-10-31T20:41:28.009+00:00[UTC]',
          type: 'LinkStart-Recruiting',
          stage: 'DONE',
          status: 'SUCCESS',
          createdAt: '2025-10-31T20:41:28.009+00:00[UTC]',
          startedAt: '2025-10-31T20:41:28.715+00:00[UTC]',
          completedAt: '2025-10-31T20:41:47.704+00:00[UTC]',
          duration: 18989,
        },
        {
          id: 'LinkStart|2025-10-31T21:12:00.011+00:00[UTC]',
          type: 'LinkStart',
          stage: 'DONE',
          status: 'SUCCESS',
          createdAt: '2025-10-31T21:12:00.011+00:00[UTC]',
          startedAt: '2025-10-31T21:12:00.834+00:00[UTC]',
          completedAt: '2025-10-31T21:20:35.008+00:00[UTC]',
          duration: 514174,
        },
      ]

      // Simplified version of logs from state.example.json
      const logs: LogRecord[] = [
        {
          timestamp: '2025-10-31T13:41:44',
          title: '任务已全部完成！(用时 0h 0m 24s)',
          lines: [],
        },
        {
          timestamp: '2025-10-31T14:10:58',
          title: '任务已全部完成！(用时 0h 27m 42s)',
          lines: [],
        },
        {
          timestamp: '2025-10-31T14:20:31',
          title: '任务已全部完成！(用时 0h 8m 26s)',
          lines: [],
        },
      ]

      const result = solveAssignment(tasks, logs)

      // Should find some valid assignments
      expect(result.assignments.length).toBeGreaterThan(0)
      expect(result.totalCost).toBeGreaterThan(0)

      // Verify assignment map works
      const assignmentMap = assignLogsToTasks(tasks, logs)
      expect(assignmentMap.size).toBeGreaterThan(0)
    })
  })
})
