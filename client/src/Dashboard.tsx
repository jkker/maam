import type { TaskData } from '@maam/server'

import { TASK_TYPE } from '@maam/server/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'

import {
  Check,
  Copy,
  ListTodo,
  LockIcon,
  Play,
  Plus,
  Search,
  SettingsIcon,
  Square,
  Terminal,
  UnlockIcon,
} from 'lucide-react'

import React, { useState } from 'react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'

import { ScheduleManager } from './components/ScheduleManager'
import { TaskStatusBadge } from './components/task-status-badge'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './components/ui/accordion'

import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { ButtonGroup } from './components/ui/button-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './components/ui/empty'
import { Field, FieldLabel } from './components/ui/field'
import { ScrollArea } from './components/ui/scroll-area'
import { Skeleton } from './components/ui/skeleton'
import { Spinner } from './components/ui/spinner'
import { Footer, Header } from './Layout'
import { queryClient, trpc } from './lib/trpc'
import { cn, formatDuration, formatTaskType, formatTime } from './utils'

export default function Dashboard() {
  const heartbeat = useQuery(trpc.heartbeat.queryOptions())
  const connected = heartbeat.data === true

  const { data: { tasks = [] } = {} } = useSubscription({
    ...trpc.state.subscriptionOptions(),
    enabled: connected,
  })
  const { data: isLocked = false } = useQuery(trpc.isLocked.queryOptions())

  return (
    <>
      <Header>
        <ConnectivityStatusIndicator
          isError={heartbeat.isError}
          isPending={heartbeat.isPending}
          isFetching={heartbeat.isFetching}
          refetch={heartbeat.refetch}
        />
      </Header>
      <main className="flex-1 container mx-auto p-4 max-w-7xl grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-auto">
        {isLocked && (
          <Alert className="col-span-full" variant="warning">
            <LockIcon />
            <AlertTitle>Manager Locked</AlertTitle>
            <AlertDescription>New non-immediate tasks are blocked</AlertDescription>
          </Alert>
        )}

        <ScreenshotViewer className="md:col-span-6 lg:col-span-8 lg:row-span-2" />

        {/* Quick Actions - Medium Box */}
        <div className="md:col-span-4 lg:col-span-6 row-span-1 flex justify-between items-center">
          <QuickActions locked={isLocked} connected={connected} />
          <LockToggle isLocked={isLocked} connected={connected} />
        </div>

        <TaskManager tasks={tasks} className="col-span-full lg:col-span-6" />
        <LogViewer className="col-span-full lg:col-span-6" />
        <ScheduleManager className="col-span-full lg:col-span-6" />
        <TaskStatistics tasks={tasks} className="md:col-span-4 lg:col-span-6" />
        <ConfigViewer className="col-span-full lg:col-span-6" />
      </main>
      <Footer />
    </>
  )
}

function ConnectivityStatusIndicator({
  isError,
  isPending,
  isFetching,
  refetch,
}: {
  isError: boolean
  isFetching: boolean
  isPending: boolean
  refetch: () => Promise<unknown>
}) {
  const [status, fg, bg] = isFetching
    ? isPending
      ? ['Connecting', 'bg-yellow-400', 'bg-yellow-500'] // initial load
      : ['Refreshing', 'bg-sky-400', 'bg-sky-500'] // refetching
    : isError
      ? ['Offline', 'bg-red-400', 'bg-red-500']
      : ['Online', 'bg-green-400', 'bg-green-500']

  return (
    <Badge
      onClick={() => refetch()}
      variant="secondary"
      className="px-3 py-1.5 flex gap-1.5 transition-all"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            `animate-ping absolute inline-flex h-full w-full rounded-full opacity-75`,
            fg,
          )}
        />
        <span className={cn(`relative inline-flex rounded-full h-2 w-2`, bg)} />
      </span>
      <span className="text-xs font-medium">{status}</span>
    </Badge>
  )
}

function ConfigViewer({
  baseURL = window.location.origin,
  className,
}: {
  baseURL?: string
  className?: string
}) {
  const [copied, setCopied] = useState<string>()

  const urls = {
    'Get Task': baseURL + '/maa/getTask',
    'Report Status': baseURL + '/maa/reportStatus',
    'Device Log Webhook': baseURL + '/maa/deviceLog',
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>
          <SettingsIcon />
          MAA Configuration URLs
        </CardTitle>
        <CardDescription>Click any URL to copy to clipboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(urls).map(([label, url]) => (
          <Field key={url} className="gap-2">
            <FieldLabel htmlFor={url}>{label}</FieldLabel>
            <InputGroup
              onClick={async (e: React.MouseEvent) => {
                e.currentTarget.getElementsByTagName('input')[0]?.select()
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(url)
                  setTimeout(() => setCopied(undefined), 2000)
                } catch (err) {
                  console.error('Failed to copy:', err)
                }
              }}
            >
              <InputGroupInput
                id={url}
                value={url}
                readOnly
                className="font-mono text-xs cursor-copy pr-0"
                title="Click to copy"
              />
              <InputGroupButton>{copied === url ? <Check /> : <Copy />}</InputGroupButton>
            </InputGroup>
          </Field>
        ))}
      </CardContent>
    </Card>
  )
}

function QuickActions({ locked, connected }: { locked: boolean; connected: boolean }) {
  const queryClient = useQueryClient()

  const start = useMutation(
    trpc.start.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  )

  const stop = useMutation(
    trpc.stop.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  )
  const dispatch = useMutation(
    trpc.dispatch.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  )
  return (
    <ButtonGroup>
      <Button
        onClick={() => start.mutate()}
        disabled={locked || !connected || start.isPending}
        className="inline-flex items-center justify-center uppercase gap-2 px-4 py-3 font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <Play className="w-4 h-4" />
        <span className="hidden sm:inline">{start.isPending ? 'Starting...' : 'Start'}</span>
      </Button>
      <Button
        onClick={() => stop.mutate()}
        disabled={!connected || stop.isPending}
        className="inline-flex items-center justify-center uppercase gap-2 px-4 py-3 font-medium transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Square className="w-4 h-4" />
        <span className="hidden sm:inline">{stop.isPending ? 'Stopping...' : 'Stop'}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!connected}>
          <Button className="inline-flex items-center justify-center uppercase gap-2 px-4 py-3 font-medium transition-all duration-200 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Task</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {TASK_TYPE.map((task) => (
            <DropdownMenuItem key={task} onSelect={() => dispatch.mutate({ task })}>
              {formatTaskType(task)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}

function TaskStatistics({ tasks, className }: { tasks: TaskData[]; className?: string }) {
  const successCount = tasks.filter((t) => t.status === 'SUCCESS').length
  const failedCount = tasks.filter((t) => t.status === 'FAILED').length
  const successRate =
    successCount + failedCount > 0
      ? ((successCount / (successCount + failedCount)) * 100).toFixed()
      : 0

  const tasksWithDuration = tasks.filter((t) => t.duration !== undefined)
  const avgDuration =
    tasksWithDuration.length > 0
      ? tasksWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / tasksWithDuration.length
      : 0

  return (
    <Card className={cn('grid grid-cols-4 gap-4', className)}>
      <CardContent className="p-0 text-center">
        <div className="text-lg font-bold text-green-500">{successCount}</div>
        <div className="text-xs text-muted-foreground">Success</div>
      </CardContent>
      <CardContent className="p-0 text-center">
        <div className="text-lg font-bold text-red-500">{failedCount}</div>
        <div className="text-xs text-muted-foreground">Failed</div>
      </CardContent>
      <CardContent className="p-0 text-center">
        <div className="text-lg font-bold text-sky-500">{successRate}%</div>
        <div className="text-xs text-muted-foreground">Completed</div>
      </CardContent>
      <CardContent className="p-0 text-center">
        <div className="text-lg font-bold text-yellow-500">
          {avgDuration > 0 ? formatDuration(avgDuration) : '-'}
        </div>
        <div className="text-xs text-muted-foreground">Duration</div>
      </CardContent>
    </Card>
  )
}

function ScreenshotViewer({ className }: { className?: string }) {
  const { data, isLoading } = useQuery(trpc.screenshotQuery.queryOptions())
  return (
    <Card
      className={cn('aspect-video overflow-hidden grid place-items-center-safe py-0', className)}
    >
      {isLoading ? (
        <Skeleton className="w-full h-full grid place-items-center">
          <Spinner className="size-4" />
        </Skeleton>
      ) : data ? (
        <img
          src={`data:image/png;base64,${data}`}
          alt="Live screenshot"
          className="w-full h-full object-contain"
        />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No screenshot available</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </Card>
  )
}

function TaskManager({
  tasks,
  isLoading = false,
  className,
}: {
  tasks: TaskData[]
  isLoading?: boolean
  className?: string
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTasks = tasks.filter(
    (task) =>
      searchQuery === '' ||
      task.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.id.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const recentTasks = filteredTasks.slice(-20).reverse()

  return (
    <Card className={cn(className, 'pb-1 gap-1')}>
      <CardHeader>
        <CardTitle>
          <ListTodo />
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <InputGroup>
          <InputGroupInput
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </CardContent>
      {isLoading && (
        <div className="p-4 space-y-2">
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-full mb-2" />
        </div>
      )}
      {!isLoading && (
        <Accordion className="w-full px-4" type="multiple">
          {recentTasks.length === 0 ? (
            <Empty>
              <EmptyDescription>No tasks yet</EmptyDescription>
            </Empty>
          ) : (
            recentTasks.map((task) => <TaskItem key={task.id} {...task} />)
          )}
        </Accordion>
      )}
    </Card>
  )
}

function TaskItem({
  stage,
  status,
  id,
  type,
  params,
  duration,
  startedAt,
  createdAt,
  completedAt,
  className,
}: TaskData & { className?: string }) {
  const displayStatus = status || stage
  const t = completedAt || startedAt || createdAt

  return (
    <AccordionItem value={id} className={className}>
      <AccordionTrigger className="flex items-center text-muted-foreground gap-2 text-xs">
        <TaskStatusBadge status={displayStatus} iconOnly />
        <h4 className="font-semibold text-primary text-sm mr-auto">{formatTaskType(type)}</h4>
        <time>{formatTime(t)}</time>
        {duration && (
          <span className="font-mono whitespace-pre">
            {formatDuration(duration)?.padStart(5, ' ')}
          </span>
        )}
      </AccordionTrigger>
      <AccordionContent className="grid grid-cols-2 gap-2 text-xs px-2">
        {params && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Params:</span>
            <p className="text-gray-900 dark:text-white break-all">{params}</p>
          </div>
        )}
        {createdAt && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Created:</span>
            <p className="text-gray-900 dark:text-white">{formatTime(createdAt)}</p>
          </div>
        )}
        {startedAt && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Started:</span>
            <p className="text-gray-900 dark:text-white">{formatTime(startedAt)}</p>
          </div>
        )}
        {completedAt && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Completed:</span>
            <p className="text-gray-900 dark:text-white">{formatTime(completedAt)}</p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

function LockToggle({
  isLocked,
  connected,
  className,
}: {
  isLocked: boolean
  connected: boolean
  className?: string
}) {
  const { variables, mutate, isPending } = useMutation(
    trpc.toggleLock.mutationOptions({
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.isLocked.queryKey() }),
      onSuccess: ({ message, success }) => (success ? toast.success : toast.error)(message),
      onError: (error) =>
        toast.error(error.data ? 'Lock Failed' : 'Unlock Failed', { description: error.message }),
    }),
  )

  return (
    <Button
      onClick={() => mutate(!isLocked)}
      className={cn(className)}
      disabled={!connected || isPending}
      variant={isLocked ? 'default' : 'destructive'}
    >
      {isPending ? <Spinner /> : isLocked ? <LockIcon className="size-3" /> : <UnlockIcon />}
      {isPending ? (variables ? 'Locking...' : 'Unlocking...') : isLocked ? 'Unlock' : 'Lock'}
    </Button>
  )
}

export function LogViewer({ className }: { className?: string }) {
  const { data: logs = [] } = useSubscription(trpc.deviceLog.subscriptionOptions())

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>
          <Terminal />
          Logs
        </CardTitle>
      </CardHeader>
      <ScrollArea className="max-h-[500px] w-full pr-4 overflow-auto">
        <CardContent>
          <Accordion type="multiple">
            {logs.length === 0 ? (
              <Empty>
                <EmptyDescription>No logs available</EmptyDescription>
              </Empty>
            ) : (
              logs.map((log, idx) => {
                const [title, content] = log.split('|', 2)
                return (
                  <AccordionItem key={idx} value={title} className="text-xs whitespace-pre-wrap">
                    <AccordionTrigger className="font-normal py-2">{title}</AccordionTrigger>
                    <AccordionContent className="font-mono text-muted-foreground whitespace-pre-wrap text-[0.75rem]">
                      {content.trim()}
                    </AccordionContent>
                  </AccordionItem>
                )
              })
            )}
          </Accordion>
        </CardContent>
      </ScrollArea>
    </Card>
  )
}
