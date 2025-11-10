import type { ScheduleData, TaskData } from '@maam/server'

import { STAGE_OPTIONS } from '@maam/server/const'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'

import {
  Check,
  Copy,
  ListTodo,
  LockIcon,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SettingsIcon,
  Square,
  Terminal,
  Trash2,
  UnlockIcon,
} from 'lucide-react'

import { useMemo, useState } from 'react'
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
import { UserMenu } from './components/UserMenu'
import { Footer, Header } from './Layout'
import { useAuthStore } from './lib/auth-store'
import { invalidateQueries, trpc } from './lib/trpc'
import { cn, formatDuration, formatTaskType, formatTime } from './utils'

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
        <div className="flex items-center gap-2">
          <ConnectivityStatusIndicator
            isError={isError}
            isPending={isPending}
            isFetching={isFetching}
          />
          <UserMenu />
        </div>
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
            {(
              [
                'LinkStart-Base',
                'LinkStart-WakeUp',
                'LinkStart-Combat',
                'LinkStart-Recruiting',
                'LinkStart-Mall',
                'LinkStart-Mission',
                'LinkStart-AutoRoguelike',
                'LinkStart-Reclamation',
                'HeartBeat',
              ] as const
            ).map((task) => (
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
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const { user, device } = useAuthStore()

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
            src={`/maa/screenshot?user=${encodeURIComponent(user!)}&device=${encodeURIComponent(device!)}`}
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

type HistoryTimelineEntry = {
  kind: 'history'
  id: string
  task: TaskData
  eventTime: Temporal.ZonedDateTime
}

type ScheduledTimelineEntry = {
  kind: 'scheduled'
  id: string
  schedule: ScheduleData
  status: 'SCHEDULED' | 'POSTPONED'
  eventTime: Temporal.ZonedDateTime
  runTime: Temporal.ZonedDateTime
}

type TimelineEntry = HistoryTimelineEntry | ScheduledTimelineEntry

type TimelineGroup = {
  day: Temporal.ZonedDateTime
  label: string
  items: TimelineEntry[]
}

const TIMELINE_WINDOW_DAYS = 7

function formatDayGroupLabel(day: Temporal.ZonedDateTime, now: Temporal.ZonedDateTime) {
  const dayDate = day.toPlainDate()
  const nowDate = now.toPlainDate()
  const diff = dayDate.since(nowDate).days

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'

  return dayDate.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function TaskManager({ className }: { className?: string }) {
  const { data: tasks = [], status } = useSubscription(trpc.tasks.subscriptionOptions())
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery(
    trpc.schedule.get.queryOptions(),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const timezone = useMemo(() => Temporal.Now.timeZoneId(), [])
  const scheduleQueryKey = trpc.schedule.get.queryKey()

  const postponeMutation = useMutation(
    trpc.schedule.postpone.mutationOptions({
      onSuccess: (data) => {
        toast.success('Next run postponed', {
          description: data.cooldownUntil
            ? `Skipped until ${formatTime(data.cooldownUntil)}`
            : undefined,
        })
        void invalidateQueries({ queryKey: scheduleQueryKey })
      },
      onError: (error) =>
        toast.error('Failed to postpone schedule', { description: error.message }),
    }),
  )

  const resumeMutation = useMutation(
    trpc.schedule.resume.mutationOptions({
      onSuccess: () => {
        toast.success('Schedule restored')
        void invalidateQueries({ queryKey: scheduleQueryKey })
      },
      onError: (error) => toast.error('Failed to restore schedule', { description: error.message }),
    }),
  )

  const removeScheduleMutation = useMutation(
    trpc.schedule.remove.mutationOptions({
      onSuccess: () => {
        toast.success('Schedule deleted')
        void invalidateQueries({ queryKey: scheduleQueryKey })
      },
      onError: (error) => toast.error('Failed to delete schedule', { description: error.message }),
    }),
  )

  const busyScheduleIds = useMemo(() => {
    const ids = new Set<string>()
    if (postponeMutation.isPending && postponeMutation.variables)
      ids.add(postponeMutation.variables.id)
    if (resumeMutation.isPending && resumeMutation.variables) ids.add(resumeMutation.variables)
    if (removeScheduleMutation.isPending && removeScheduleMutation.variables)
      ids.add(removeScheduleMutation.variables)
    return ids
  }, [
    postponeMutation.isPending,
    postponeMutation.variables,
    resumeMutation.isPending,
    resumeMutation.variables,
    removeScheduleMutation.isPending,
    removeScheduleMutation.variables,
  ])

  const { groups, total } = useMemo(() => {
    const now = Temporal.Now.zonedDateTimeISO(timezone)
    const startRange = now.subtract({ days: TIMELINE_WINDOW_DAYS })
    const endRange = now.add({ days: TIMELINE_WINDOW_DAYS })
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const matchesQuery = (haystack: string) =>
      normalizedQuery === '' || haystack.toLowerCase().includes(normalizedQuery)

    const historyEntries: HistoryTimelineEntry[] = []
    for (const task of tasks) {
      const timestamp = task.completedAt || task.startedAt || task.createdAt
      if (!timestamp) continue
      const eventTime = Temporal.ZonedDateTime.from(timestamp).withTimeZone(timezone)
      if (Temporal.ZonedDateTime.compare(eventTime, startRange) < 0) continue
      if (Temporal.ZonedDateTime.compare(eventTime, endRange) > 0) continue

      const haystack = [task.type, task.id, task.params ?? '', task.status ?? '', task.stage]
        .join(' ')
        .toLowerCase()
      if (!matchesQuery(haystack)) continue

      historyEntries.push({ kind: 'history', id: task.id, task, eventTime })
    }

    const upcomingEntries: ScheduledTimelineEntry[] = []
    for (const schedule of schedules) {
      const scheduleTimezone = schedule.timezone ?? timezone
      const scheduleNow = Temporal.Now.zonedDateTimeISO(scheduleTimezone)
      const horizon = scheduleNow.add({ days: TIMELINE_WINDOW_DAYS })
      let candidate = scheduleNow.with({
        hour: schedule.hour,
        minute: schedule.minute ?? 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      })
      if (Temporal.ZonedDateTime.compare(candidate, scheduleNow) <= 0) {
        candidate = candidate.add({ days: 1 })
      }

      let cooldown = schedule.cooldownUntil
        ? Temporal.ZonedDateTime.from(schedule.cooldownUntil).withTimeZone(scheduleTimezone)
        : undefined

      const baseHaystack = [
        schedule.type,
        schedule.id,
        schedule.params ?? '',
        formatTaskType(schedule.type),
      ]
        .join(' ')
        .toLowerCase()

      while (Temporal.ZonedDateTime.compare(candidate, horizon) <= 0) {
        const localTime = candidate.withTimeZone(timezone)
        if (Temporal.ZonedDateTime.compare(localTime, endRange) > 0) break
        if (Temporal.ZonedDateTime.compare(localTime, startRange) < 0) {
          candidate = candidate.add({ days: 1 })
          continue
        }

        if (cooldown && Temporal.ZonedDateTime.compare(candidate, cooldown) === 0) {
          if (matchesQuery(baseHaystack)) {
            upcomingEntries.push({
              kind: 'scheduled',
              id: `${schedule.id}|${candidate.toString()}|postponed`,
              schedule,
              status: 'POSTPONED',
              eventTime: localTime,
              runTime: candidate,
            })
          }
          cooldown = undefined
          candidate = candidate.add({ days: 1 })
          continue
        }

        if (matchesQuery(baseHaystack)) {
          upcomingEntries.push({
            kind: 'scheduled',
            id: `${schedule.id}|${candidate.toString()}`,
            schedule,
            status: 'SCHEDULED',
            eventTime: localTime,
            runTime: candidate,
          })
        }

        candidate = candidate.add({ days: 1 })
      }
    }

    const combined: TimelineEntry[] = [...historyEntries, ...upcomingEntries]
    combined.sort((a, b) => Temporal.ZonedDateTime.compare(a.eventTime, b.eventTime))

    const groupMap = new Map<string, TimelineGroup>()
    for (const entry of combined) {
      const dayStart = entry.eventTime.with({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      })
      const key = dayStart.toString()
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          day: dayStart,
          label: formatDayGroupLabel(dayStart, now),
          items: [],
        })
      }
      groupMap.get(key)!.items.push(entry)
    }

    const groups = Array.from(groupMap.values()).sort((a, b) =>
      Temporal.ZonedDateTime.compare(a.day, b.day),
    )

    for (const group of groups) {
      group.items.sort((a, b) => Temporal.ZonedDateTime.compare(a.eventTime, b.eventTime))
    }

    return { groups, total: combined.length }
  }, [tasks, schedules, timezone, searchQuery])

  const isLoading = status === 'connecting' || schedulesLoading

  const handlePostpone = (scheduleId: string) => postponeMutation.mutate({ id: scheduleId })
  const handleResume = (scheduleId: string) => resumeMutation.mutate(scheduleId)
  const handleDelete = (scheduleId: string) => removeScheduleMutation.mutate(scheduleId)

  return (
    <Card className={cn(className, 'flex flex-col overflow-hidden pb-0 gap-0')}>
      <CardHeader>
        <CardTitle>
          <ListTodo />
          Tasks
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Past {TIMELINE_WINDOW_DAYS} days &amp; next {TIMELINE_WINDOW_DAYS} days · Timezone:{' '}
          {timezone}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InputGroup>
          <InputGroupInput
            type="search"
            placeholder="Search by type, ID, or params"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText>
              {total} item{total === 1 ? '' : 's'}
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </CardContent>
      <div className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Empty>
              <EmptyDescription>
                {searchQuery
                  ? 'No tasks match your search'
                  : 'Nothing scheduled for this window yet'}
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <ScrollArea className="max-h-[24rem] md:max-h-[28rem] lg:max-h-[32rem]">
            <div className="space-y-6 pr-4">
              {groups.map((group) => (
                <section key={group.day.toString()} className="space-y-3">
                  <div className="sticky top-0 z-10 -mx-4 border-b bg-card/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/75">
                    <div className="flex items-baseline justify-between gap-2">
                      <span>{group.label}</span>
                      <span>
                        {group.day.toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <Accordion type="multiple" className="space-y-2">
                    {group.items.map((entry) => (
                      <TaskTimelineItem
                        key={entry.id}
                        entry={entry}
                        timezone={timezone}
                        onPostpone={handlePostpone}
                        onResume={handleResume}
                        onDelete={handleDelete}
                        isBusy={
                          entry.kind === 'scheduled' && busyScheduleIds.has(entry.schedule.id)
                        }
                      />
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  )
}

type TaskTimelineItemProps = {
  entry: TimelineEntry
  timezone: string
  onPostpone: (scheduleId: string) => void
  onResume: (scheduleId: string) => void
  onDelete: (scheduleId: string) => void
  isBusy: boolean
}

function TaskTimelineItem({
  entry,
  timezone,
  onPostpone,
  onResume,
  onDelete,
  isBusy,
}: TaskTimelineItemProps) {
  if (entry.kind === 'history') {
    const { task, eventTime } = entry
    const status = task.status ?? task.stage
    const isFailed = status === 'FAILED'
    const isCancelled = status === 'CANCELLED'

    return (
      <AccordionItem
        value={entry.id}
        className={cn(
          'rounded-lg border bg-card/60 shadow-sm transition hover:border-primary/30',
          isFailed && 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20',
          isCancelled && 'opacity-70',
        )}
      >
        <AccordionTrigger className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground hover:no-underline">
          <TaskStatusBadge status={status} iconOnly />
          <div className="flex flex-1 flex-col text-left">
            <span className="text-sm font-semibold text-primary">{formatTaskType(task.type)}</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(eventTime)} · {task.stage}
              {task.status ? ` (${task.status})` : ''}
            </span>
          </div>
          {task.duration && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatDuration(task.duration)}
            </span>
          )}
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 text-xs">
          {isFailed && (
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
              ⚠️ This task failed or timed out after 24 hours
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium text-primary">{formatTime(task.createdAt)}</p>
            </div>
            {task.startedAt && (
              <div>
                <span className="text-muted-foreground">Started</span>
                <p className="font-medium text-primary">{formatTime(task.startedAt)}</p>
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-muted-foreground">Completed</span>
                <p className="font-medium text-primary">{formatTime(task.completedAt)}</p>
              </div>
            )}
            {task.params && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Params</span>
                <p className="break-all font-mono text-muted-foreground/90">{task.params}</p>
              </div>
            )}
          </div>
          <div className="mt-2 text-[0.7rem] text-muted-foreground">Task ID: {task.id}</div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const { schedule, status, eventTime, runTime } = entry
  const scheduleTimezone = schedule.timezone ?? timezone
  const isPostponed = status === 'POSTPONED'

  return (
    <AccordionItem
      className="rounded-lg border bg-card/60 shadow-sm transition hover:border-primary/30"
      value={entry.id}
    >
      <AccordionTrigger className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground hover:no-underline">
        <TaskStatusBadge status={status} iconOnly />
        <div className="flex flex-1 flex-col text-left">
          <span className="text-sm font-semibold text-primary">
            {formatTaskType(schedule.type)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isPostponed ? 'Postponed run' : 'Scheduled'} ·{' '}
            {eventTime.toLocaleString(undefined, { timeStyle: 'short' })}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy}>
              {isBusy ? <Spinner className="size-4" /> : <MoreVertical className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {isPostponed ? (
              <DropdownMenuItem onSelect={() => onResume(schedule.id)} disabled={isBusy}>
                <RotateCcw className="size-4" />
                Restore next run
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onPostpone(schedule.id)} disabled={isBusy}>
                <Pause className="size-4" />
                Skip next run
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(schedule.id)}
              disabled={isBusy}
            >
              <Trash2 className="size-4" />
              Delete schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3 text-xs space-y-3">
        {isPostponed && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            This occurrence has been postponed. Restore it to re-enable the next run.
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Local run time</span>
            <p className="font-medium text-primary">{formatTime(eventTime)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Schedule timezone ({scheduleTimezone})</span>
            <p className="font-medium text-primary">
              {runTime.toLocaleString(undefined, { timeStyle: 'short', timeZoneName: 'short' })}
            </p>
          </div>
          {schedule.params && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Params</span>
              <p className="break-all font-mono text-muted-foreground/90">{schedule.params}</p>
            </div>
          )}
        </div>
        <div className="text-[0.7rem] text-muted-foreground">Schedule ID: {schedule.id}</div>
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
