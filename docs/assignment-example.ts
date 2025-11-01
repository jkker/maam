/**
 * Example: Using the Assignment Solver with state.example.json
 *
 * This example demonstrates how to use the assignment solver to match
 * tasks to their corresponding logs.
 */

import { readFileSync } from 'fs'
import { assignLogsToTasks, solveAssignment, logCodec } from '@maam/server'

// Load the example data
const data = JSON.parse(readFileSync('./data/state.example.json', 'utf-8'))

const tasks = data.tasks
const logs = data.logs.map((logStr: string) => logCodec.decode(logStr))

console.log('Tasks:', tasks.length)
console.log('Logs:', logs.length)

// Method 1: Simple assignment (returns Map<taskId, log>)
const assignmentMap = assignLogsToTasks(tasks, logs)
console.log('\nAssignments:', assignmentMap.size)

// Method 2: Detailed assignment analysis
const result = solveAssignment(tasks, logs)
console.log('Total cost:', Math.round(result.totalCost / 1000), 'seconds')
console.log('Assignments:', result.assignments)

// Example: Find which log corresponds to a specific task
for (const [taskId, log] of assignmentMap) {
  console.log(`Task ${taskId} -> Log at ${log.timestamp}`)
}

// Example: Custom parameters
const customResult = solveAssignment(tasks, logs, {
  timeWeight: 2.0, // Prioritize time matching
  durationWeight: 0.05, // Less weight on duration
  maxCost: 3600000, // Max 1 hour difference
})
console.log('\nCustom assignments:', customResult.assignments.length)
