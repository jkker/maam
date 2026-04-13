import 'temporal-polyfill/global'
import { expect, test, vi, beforeEach } from 'vite-plus/test'

import {
  useTasksStore,
  selectFilteredTasks,
  selectTaskStats,
  selectOverdueTasks,
  addTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  setFilter,
  clearCompleted,
} from '#/lib/tasks-store'

beforeEach(() => {
  useTasksStore.setState({
    tasks: [],
    filter: 'all',
    selected: undefined,
  })
})

test('adds a new task', () => {
  addTask({
    title: 'Test Task',
    description: 'Test Description',
    status: 'todo',
    priority: 'medium',
  })

  const tasks = useTasksStore.getState().tasks

  expect(tasks).toHaveLength(1)
  expect(tasks[0].title).toBe('Test Task')
  expect(tasks[0].status).toBe('todo')
  expect(tasks[0].id).toBeDefined()
})

test('updates a task', () => {
  addTask({
    title: 'Original Title',
    status: 'todo',
    priority: 'low',
  })

  const taskId = useTasksStore.getState().tasks[0].id

  updateTask(taskId, { title: 'Updated Title', status: 'in-progress' })

  const task = useTasksStore.getState().tasks[0]

  expect(task.title).toBe('Updated Title')
  expect(task.status).toBe('in-progress')
})

test('deletes a task', () => {
  addTask({
    title: 'Task to Delete',
    status: 'todo',
    priority: 'low',
  })

  const taskId = useTasksStore.getState().tasks[0].id

  deleteTask(taskId)

  expect(useTasksStore.getState().tasks).toHaveLength(0)
})

test('sets task status', () => {
  addTask({
    title: 'Task',
    status: 'todo',
    priority: 'low',
  })

  const taskId = useTasksStore.getState().tasks[0].id

  setTaskStatus(taskId, 'done')

  expect(useTasksStore.getState().tasks[0].status).toBe('done')
})

test('filters tasks by status', () => {
  addTask({ title: 'Task 1', status: 'todo', priority: 'low' })
  addTask({ title: 'Task 2', status: 'done', priority: 'low' })
  addTask({
    title: 'Task 3',
    status: 'in-progress',
    priority: 'low',
  })

  setFilter('active')

  const filteredTasks = selectFilteredTasks(useTasksStore.getState())

  expect(filteredTasks).toHaveLength(2)
  expect(filteredTasks.every((task) => task.status !== 'done')).toBe(true)
})

test('calculates task stats', () => {
  addTask({ title: 'Task 1', status: 'todo', priority: 'low' })
  addTask({ title: 'Task 2', status: 'done', priority: 'low' })
  addTask({
    title: 'Task 3',
    status: 'in-progress',
    priority: 'low',
  })

  const stats = selectTaskStats(useTasksStore.getState())

  expect(stats.total).toBe(3)
  expect(stats.todo).toBe(1)
  expect(stats.inProgress).toBe(1)
  expect(stats.done).toBe(1)
})

test('clears completed tasks', () => {
  addTask({ title: 'Task 1', status: 'todo', priority: 'low' })
  addTask({ title: 'Task 2', status: 'done', priority: 'low' })
  addTask({ title: 'Task 3', status: 'done', priority: 'low' })

  clearCompleted()

  const tasks = useTasksStore.getState().tasks

  expect(tasks).toHaveLength(1)
  expect(tasks[0].status).toBe('todo')
})

test('validates task data with Arktype', () => {
  expect(() =>
    addTask({
      title: 'Test',
      status: 'todo',
      priority: 'medium',
      dueDate: 'not-a-valid-date',
    }),
  ).toThrow()
})

test('identifies overdue tasks', () => {
  vi.setSystemTime(new Date('2025-01-01T12:00:00'))

  addTask({
    title: 'Overdue Task',
    status: 'todo',
    priority: 'high',
    dueDate: '2024-12-31T12:00:00',
  })

  addTask({
    title: 'Future Task',
    status: 'todo',
    priority: 'low',
    dueDate: '2025-01-05T12:00:00',
  })

  const overdueTasks = selectOverdueTasks(useTasksStore.getState())

  expect(overdueTasks).toHaveLength(1)
  expect(overdueTasks[0].title).toBe('Overdue Task')

  vi.useRealTimers()
})
