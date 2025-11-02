import type { TaskData } from '@maam/server'

import { TASK_TYPE } from '@maam/server/const'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'

import {
  Check,
  Copy,
  ListTodo,
  LockIcon,
  Play,
  Plus,
  Search,
  Settings2,
  SettingsIcon,
  Square,
  Terminal,
  UnlockIcon,
} from 'lucide-react'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Temporal } from 'temporal-polyfill'

import { Autocomplete } from '@/components/ui/autocomplete'

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

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
import { invalidateQueries, trpc } from './lib/trpc'
import { cn, formatDuration, formatTaskType, formatTime } from './utils'

// Stage selection data with availability by weekday
interface StageOption {
  id: string
  label: string
  weekdays?: number[] // 1=Monday, 7=Sunday; empty means all days
}

const STAGE_OPTIONS: StageOption[] = [
  { id: 'default', label: '当前/上次' },
  // 主线关卡
  { id: '1-7', label: '固源岩' },
  { id: 'R8-11', label: '晶体元件' },
  { id: '12-17-HARD', label: '化合切削液' },
  // 资源本
  { id: 'CE-6', label: '龙门币', weekdays: [2, 4, 6, 7] },
  { id: 'AP-5', label: '红票', weekdays: [1, 4, 6, 7] },
  { id: 'CA-5', label: '技能', weekdays: [2, 3, 5, 7] },
  { id: 'LS-6', label: '经验' },
  { id: 'SK-5', label: '碳', weekdays: [1, 3, 5, 6] },
  // 剿灭模式
  { id: 'Annihilation', label: '剿灭模式' },
  // 芯片本
  { id: 'PR-A-1', label: '奶/盾芯片', weekdays: [1, 4, 5, 7] },
  { id: 'PR-A-2', label: '奶/盾芯片组', weekdays: [1, 4, 5, 7] },
  { id: 'PR-B-1', label: '术/狙芯片', weekdays: [1, 2, 5, 6] },
  { id: 'PR-B-2', label: '术/狙芯片组', weekdays: [1, 2, 5, 6] },
  { id: 'PR-C-1', label: '先/辅芯片', weekdays: [3, 4, 6, 7] },
  { id: 'PR-C-2', label: '先/辅芯片组', weekdays: [3, 4, 6, 7] },
  { id: 'PR-D-1', label: '近/特芯片', weekdays: [2, 3, 6, 7] },
  { id: 'PR-D-2', label: '近/特芯片组', weekdays: [2, 3, 6, 7] },
]

export default function Dashboard() {
  const {
    data: locked = false,
    isSuccess,
    isError,
    isPending,
    isFetching,
  } = useQuery(trpc.locked.queryOptions())

  return (
    <>
      <Header>
        <ConnectivityStatusIndicator
          isError={isError}
          isPending={isPending}
          isFetching={isFetching}
        />
      </Header>
      <main className="flex-1 container mx-auto p-4 max-w-7xl grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-min">
        {locked && (
          <Alert className="col-span-full" variant="warning">
            <LockIcon />
            <AlertTitle>Manager Locked</AlertTitle>
            <AlertDescription>New non-immediate tasks are blocked</AlertDescription>
          </Alert>
        )}

        <ScreenshotViewer className="col-span-full" />

        <div className="col-span-full gap-4 grid grid-cols-1 md:grid-cols-2">
          <QuickActions locked={locked} connected={isSuccess} />
          <LockToggle locked={locked} connected={isSuccess} />
        </div>

        <TaskManager className="col-span-full lg:col-span-6" />
        <LogViewer className="col-span-full lg:col-span-6" />
        <ScheduleManager className="col-span-full" connected={isSuccess} />
        <ConfigViewer className="col-span-full" />
      </main>
      <Footer />
    </>
  )
}

function ConnectivityStatusIndicator({
  isError,
  isPending,
  isFetching,
}: {
  isError: boolean
  isFetching: boolean
  isPending: boolean
}) {
  const [status, fg, bg] = isFetching
    ? isPending
      ? ['Connecting', 'bg-yellow-400', 'bg-yellow-500'] // initial load
      : ['Refreshing', 'bg-sky-400', 'bg-sky-500'] // refetching
    : isError
      ? ['Offline', 'bg-red-400', 'bg-red-500']
      : ['Online', 'bg-green-400', 'bg-green-500']

  return (
    <Badge variant="secondary" className="px-3 py-1.5 flex gap-1.5 transition-all">
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

const { dayOfWeek } = Temporal.Now.zonedDateTimeISO('Asia/Shanghai')
const stageOptionsList = STAGE_OPTIONS.map(({ id, label, weekdays }) => {
  const text = `${id} - ${label}`
  if (!weekdays?.length) return { value: id, label: text }
  const weekdaysList = weekdays.map((d) => {
    const t = ['一', '二', '三', '四', '五', '六', '日'][d - 1]
    return d === dayOfWeek ? <b key={d}>{t}</b> : t
  })

  return {
    value: id,
    label: (
      <div className="flex items-center justify-between gap-2">
        {text}
        <ul className="ml-auto inline-flex text-muted-foreground">{weekdaysList}</ul>
      </div>
    ),
    disabled: weekdays && !weekdays.includes(dayOfWeek),
  }
})
function QuickActions({ locked, connected }: { locked: boolean; connected: boolean }) {
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const start = useMutation(trpc.start.mutationOptions({ onSuccess: () => invalidateQueries() }))
  const stop = useMutation(trpc.stop.mutationOptions({ onSuccess: () => invalidateQueries() }))

  const dispatch = useMutation(
    trpc.dispatch.mutationOptions({
      onSuccess: () => {
        void invalidateQueries()
        setStagePopoverOpen(false)
        setSelectedStage(null)
      },
    }),
  )

  return (
    <div className="flex gap-2">
      <ButtonGroup className="flex-1">
        <Button
          onClick={() => start.mutate()}
          disabled={locked || !connected || start.isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Play className="w-4 h-4" />
          {start.isPending ? 'Starting...' : 'Start'}
        </Button>
        <Button
          onClick={() => stop.mutate()}
          disabled={!connected || stop.isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Square className="w-4 h-4" />
          <span>{stop.isPending ? 'Stopping...' : 'Stop'}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!connected}>
            <Button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all duration-200 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              <Plus className="w-4 h-4" />
              <span>Task</span>
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
      {/* Stage Selection Popover */}
      <Popover open={stagePopoverOpen} onOpenChange={setStagePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={!connected || locked}
            variant="outline"
            size="lg"
            className="px-3"
            title="Select stage to fight"
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-4">
          <Autocomplete
            options={stageOptionsList}
            value={selectedStage}
            onChange={setSelectedStage}
            placeholder="Search stages..."
            emptyMessage="No stages available today."
            allowArbitrary={true}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                dispatch.mutate({ task: 'Settings-Stage1', params: selectedStage || undefined })
              }}
              disabled={!selectedStage || dispatch.isPending}
              className="flex-1"
            >
              {dispatch.isPending ? 'Selecting...' : 'Select'}
            </Button>
            <Button onClick={() => setStagePopoverOpen(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ScreenshotViewer({ className }: { className?: string }) {
  const [imageError, setImageError] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  return (
    <Card className={cn('aspect-video overflow-hidden flex flex-col py-0 relative', className)}>
      {/* Screenshot display area */}
      <div className="flex-1 grid place-items-center-safe">
        {isLoading && (
          <Skeleton className="w-full h-full grid place-items-center absolute">
            <Spinner className="size-4" />
          </Skeleton>
        )}
        {imageError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No screenshot available</EmptyTitle>
            </EmptyHeader>
            <EmptyDescription>Device is offline</EmptyDescription>
          </Empty>
        ) : (
          <img
            src="/screenshot-stream"
            alt="Live screenshot"
            className="w-full h-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setImageError(true)
            }}
          />
        )}
      </div>
    </Card>
  )
}

function TaskManager({ className }: { className?: string }) {
  const { data: tasks = [], status } = useSubscription(trpc.tasks.subscriptionOptions())
  const [searchQuery, setSearchQuery] = useState('')
  const isLoading = status === 'connecting'

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
  const isFailed = status === 'FAILED'
  const isCancelled = status === 'CANCELLED'

  return (
    <AccordionItem value={id} className={className}>
      <AccordionTrigger
        className={cn(
          'flex items-center text-muted-foreground gap-2 text-xs',
          isFailed && 'bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500',
          isCancelled && 'opacity-60',
        )}
      >
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
        {isFailed && (
          <div className="col-span-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2 mb-2">
            <span className="text-red-600 dark:text-red-400 font-medium">
              ⚠️ This task failed or timed out after 24 hours
            </span>
          </div>
        )}
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
  locked,
  connected,
  className,
}: {
  locked: boolean
  connected: boolean
  className?: string
}) {
  const { variables, mutate, isPending } = useMutation(
    trpc.toggleLock.mutationOptions({
      onSettled: () => invalidateQueries({ queryKey: trpc.locked.queryKey() }),
      onSuccess: ({ message, success }) => (success ? toast.success : toast.error)(message),
      onError: (error) =>
        toast.error(error.data ? 'Lock Failed' : 'Unlock Failed', { description: error.message }),
    }),
  )

  return (
    <Button
      onClick={() => mutate(!locked)}
      className={cn('w-full', className)}
      disabled={!connected || isPending}
      variant={locked ? 'default' : 'destructive'}
      size="lg"
    >
      {isPending ? (
        <Spinner />
      ) : locked ? (
        <LockIcon className="size-4 mr-2" />
      ) : (
        <UnlockIcon className="size-4 mr-2" />
      )}
      {isPending
        ? variables
          ? 'Locking...'
          : 'Unlocking...'
        : locked
          ? 'Unlock Manager'
          : 'Lock Manager'}
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
