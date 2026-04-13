import { CheckIcon, ClockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '#/components/ui/responsive-dialog'
import { Textarea } from '#/components/ui/textarea'
import {
  addTask,
  setTaskStatus,
  setFilter as setTaskFilter,
  deleteTask,
  clearCompleted,
  useTasksStore,
  selectFilteredTasks,
  selectTaskStats,
} from '#/lib/tasks-store'
import { formatRelativeTime, isOverdue, isDueSoon } from '#/lib/temporal-utils'

export function TaskListExample() {
  const [open, setOpen] = React.useState(false)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const [newTaskDesc, setNewTaskDesc] = React.useState('')
  const tasks = useTasksStore(useShallow(selectFilteredTasks))
  const stats = useTasksStore(useShallow(selectTaskStats))
  const filter = useTasksStore((state) => state.filter)

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return

    const dueDate = Temporal.Now.plainDateTimeISO().add({ days: 7 }).toString()

    addTask({
      title: newTaskTitle,
      description: newTaskDesc,
      status: 'todo',
      priority: 'medium',
      dueDate,
    })

    setNewTaskTitle('')
    setNewTaskDesc('')
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Task Manager</CardTitle>
          <ResponsiveDialog open={open} onOpenChange={setOpen}>
            <ResponsiveDialogTrigger render={<Button size="sm" />}>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Task
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Create New Task</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Add a new task to your list
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="grid gap-4 p-4">
                <div className="grid gap-2">
                  <label htmlFor="task-title">Title</label>
                  <Input
                    id="task-title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="task-desc">Description</label>
                  <Textarea
                    id="task-desc"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Task description"
                  />
                </div>
              </div>
              <ResponsiveDialogFooter>
                <Button onClick={handleAddTask}>Add Task</Button>
                <ResponsiveDialogClose render={<Button variant="outline" />}>
                  Cancel
                </ResponsiveDialogClose>
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
        <div className="mt-4 flex gap-2">
          {(['all', 'active', 'completed'] as const).map((filterType) => (
            <Button
              key={filterType}
              variant={filter === filterType ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTaskFilter(filterType)}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)} (
              {filterType === 'all'
                ? stats.total
                : filterType === 'active'
                  ? stats.todo + stats.inProgress
                  : stats.done}
              )
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No tasks yet. Create your first task!
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={`mt-0.5 ${task.status === 'done' ? 'text-green-500' : 'text-muted-foreground'}`}
                  onClick={() => setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                  aria-label={
                    task.status === 'done'
                      ? `Mark "${task.title}" as todo`
                      : `Mark "${task.title}" as done`
                  }
                >
                  <CheckIcon className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : ''}`}
                    >
                      {task.title}
                    </p>
                    <Badge
                      variant={
                        task.priority === 'high'
                          ? 'destructive'
                          : task.priority === 'medium'
                            ? 'default'
                            : 'secondary'
                      }
                      className="text-xs"
                    >
                      {task.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {task.status}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                  )}
                  {task.dueDate && task.status !== 'done' && (
                    <div className="mt-2 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3 text-muted-foreground" />
                      <span
                        className={`text-xs ${isOverdue(task.dueDate.toString()) ? 'text-destructive' : isDueSoon(task.dueDate.toString()) ? 'text-orange-500' : 'text-muted-foreground'}`}
                      >
                        {formatRelativeTime(task.dueDate.toString())}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Delete "${task.title}"`}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
        {stats.done > 0 && (
          <div className="mt-4 border-t pt-4">
            <Button variant="outline" size="sm" onClick={clearCompleted} className="w-full">
              <Trash2Icon className="mr-2 h-4 w-4" />
              Clear Completed ({stats.done})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
