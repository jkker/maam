import { type } from 'arktype'
import { Temporal } from 'temporal-polyfill'
import { create } from 'zustand'

const TaskStatus = type("'todo' | 'in-progress' | 'done'")
const TaskPriority = type("'low' | 'medium' | 'high'")
const PlainDateTime = type.instanceOf(Temporal.PlainDateTime)

const Task = type({
  title: 'string',
  priority: TaskPriority.default('medium'),
  status: TaskStatus.default('todo'),
  'description?': 'string',
  'dueDate?': 'string',
}).pipe.try(
  ({ dueDate, ...input }) => ({
    ...input,
    id: crypto.randomUUID(),
    dueDate: dueDate ? Temporal.PlainDateTime.from(dueDate) : undefined,
    createdAt: Temporal.Now.plainDateTimeISO(),
  }),
  type({
    id: 'string.uuid',
    title: 'string',
    'description?': 'string',
    status: TaskStatus,
    priority: TaskPriority,
    dueDate: PlainDateTime.or('undefined'),
    createdAt: PlainDateTime,
  }),
)

const TaskUpdate = Task.out.partial().omit('id', 'createdAt')

type Tasks = Array<typeof Task.out.infer>

interface TasksState {
  tasks: Tasks
  filter: 'all' | 'active' | 'completed'
  selected?: string
}

export const useTasksStore = create<TasksState>(() => ({ tasks: [], filter: 'all' }))

export const addTask = (taskData: typeof Task.in.infer) =>
  useTasksStore.setState(({ tasks }) => ({ tasks: [...tasks, Task.from(taskData)] }))

export const updateTask = (id: string, updates: typeof TaskUpdate.infer) =>
  useTasksStore.setState(({ tasks }) => ({
    tasks: tasks.map((task) => (task.id === id ? { ...task, ...TaskUpdate.from(updates) } : task)),
  }))

export const deleteTask = (id: string) =>
  useTasksStore.setState(({ tasks }) => ({
    tasks: tasks.filter(({ id: taskId }) => taskId !== id),
  }))

export const setTaskStatus = (id: string, status: typeof TaskStatus.infer) =>
  updateTask(id, { status })

export const setFilter = (filter: TasksState['filter']) => useTasksStore.setState({ filter })

export const clearCompleted = () =>
  useTasksStore.setState(({ tasks }) => ({
    tasks: tasks.filter(({ status }) => status !== 'done'),
  }))

export const selectFilteredTasks = ({ tasks, filter }: TasksState) => {
  switch (filter) {
    case 'active':
      return tasks.filter(({ status }) => status !== 'done')
    case 'completed':
      return tasks.filter(({ status }) => status === 'done')
  }
  return tasks
}

export const selectOverdueTasks = ({ tasks }: { tasks: Tasks }) => {
  const now = Temporal.Now.plainDateTimeISO()
  return tasks.filter(
    ({ dueDate, status }) =>
      dueDate && status !== 'done' && Temporal.PlainDateTime.compare(dueDate, now) < 0,
  )
}

export const selectTaskStats = ({ tasks }: { tasks: Tasks }) => ({
  total: tasks.length,
  todo: tasks.filter(({ status }) => status === 'todo').length,
  inProgress: tasks.filter(({ status }) => status === 'in-progress').length,
  done: tasks.filter(({ status }) => status === 'done').length,
  overdue: selectOverdueTasks({ tasks }).length,
})
