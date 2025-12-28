import type { ScheduleData, TaskData } from '@maam/server'

import { formatDuration, formatTime } from '@maam/server/lib/temporal'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ListTodo, MoreVertical, Pause, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Temporal } from 'temporal-polyfill'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { invalidateQueries, useRPC } from '@/lib/orpc'
import { cn, formatTaskType } from '@/lib/utils'

import { TaskStatusBadge } from './task-status-badge'

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

export function TaskManager({ className }: { className?: string }) {
  const { orpc, isAuthenticated } = useRPC()
  const { data: tasks = [] } = useQuery(
    orpc.tasks.experimental_liveOptions({
      input: undefined,
      retry: true,
      enabled: isAuthenticated,
    }),
  )
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery(
    orpc.schedule.get.queryOptions({ input: undefined, enabled: isAuthenticated }),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const timezone = useMemo(() => Temporal.Now.timeZoneId(), [])
  const scheduleQueryKey = orpc.schedule.get.queryKey()

  const postponeMutation = useMutation(
    orpc.schedule.postpone.mutationOptions({
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
    orpc.schedule.resume.mutationOptions({
      onSuccess: () => {
        toast.success('Schedule restored')
        void invalidateQueries({ queryKey: scheduleQueryKey })
      },
      onError: (error) => toast.error('Failed to restore schedule', { description: error.message }),
    }),
  )

  const removeScheduleMutation = useMutation(
    orpc.schedule.remove.mutationOptions({
      onSuccess: () => {
        toast.success('Schedule deleted')
        void invalidateQueries({ queryKey: scheduleQueryKey })
      },
      onError: (error) => toast.error('Failed to delete schedule', { description: error.message }),
    }),
  )

  const clearHistoryMutation = useMutation(
    orpc.clearHistory.mutationOptions({
      onSuccess: () => {
        toast.success('Task history cleared')
        void invalidateQueries()
      },
      onError: (error) => toast.error('Failed to clear history', { description: error.message }),
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

  const isLoading = !isAuthenticated || schedulesLoading

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader className="flex flex-col space-y-4 pb-4">
        <div className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="size-5" />
              <span>Tasks</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {timezone} · {total} item{total === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
            disabled={clearHistoryMutation.isPending || groups.length === 0}
            onClick={() => {
              if (confirm('Are you sure you want to clear all completed tasks?')) {
                clearHistoryMutation.mutate(undefined)
              }
            }}
          >
            {clearHistoryMutation.isPending ? (
              <Spinner className="size-3" />
            ) : (
              <Trash2 className="size-3" />
            )}
            Clear
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by type, ID, or params..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-64 items-center justify-center p-6">
            <Empty>
              <EmptyDescription>
                {searchQuery
                  ? 'No tasks match your search'
                  : 'Nothing scheduled for this window yet'}
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <ScrollArea className="h-[500px] w-full">
            <div className="p-4 pt-0">
              <Accordion type="multiple" className="space-y-6">
                {groups.map((group) => (
                  <div key={group.day.toString()} className="space-y-3">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 py-2 text-sm font-semibold text-muted-foreground backdrop-blur-sm">
                      <span>{group.label}</span>
                      <span className="text-xs font-normal opacity-75">
                        {group.day.toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {group.items.map((entry) => (
                        <TaskTimelineItem
                          key={entry.id}
                          entry={entry}
                          timezone={timezone}
                          onPostpone={(id) => postponeMutation.mutate({ id })}
                          onResume={(id) => resumeMutation.mutate(id)}
                          onDelete={(id) => removeScheduleMutation.mutate(id)}
                          isBusy={
                            entry.kind === 'scheduled' && busyScheduleIds.has(entry.schedule.id)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </Accordion>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function TaskTimelineItem({
  entry,
  timezone,
  onPostpone,
  onResume,
  onDelete,
  isBusy,
}: {
  entry: TimelineEntry
  timezone: string
  onPostpone: (scheduleId: string) => void
  onResume: (scheduleId: string) => void
  onDelete: (scheduleId: string) => void
  isBusy: boolean
}) {
  if (entry.kind === 'history') {
    const { task, eventTime } = entry
    const status = task.status ?? task.stage
    const isFailed = status === 'FAILED'
    const isCancelled = status === 'CANCELLED'

    return (
      <AccordionItem
        value={entry.id}
        className={cn(
          'group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50',
          isFailed && 'border-destructive/50 bg-destructive/5',
          isCancelled && 'opacity-70',
        )}
      >
        <AccordionTrigger className="px-3 py-2 hover:no-underline [&[data-state=open]]:bg-accent/50">
          <div className="flex w-full items-center gap-3">
            <TaskStatusBadge status={status} iconOnly />
            <div className="flex flex-1 flex-col items-start gap-0.5 text-left">
              <span className="text-sm font-medium leading-none">{formatTaskType(task.type)}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{formatTime(eventTime)}</span>
                <span>·</span>
                <span>{task.stage}</span>
              </div>
            </div>
            {task.duration && (
              <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
                {formatDuration(task.duration)}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t bg-muted/20 px-3 py-3">
          <div className="grid gap-4 text-xs sm:grid-cols-2">
            {isFailed && (
              <div className="col-span-full rounded-md border border-destructive/20 bg-destructive/10 p-2 text-destructive">
                This task failed or timed out after 24 hours
              </div>
            )}

            <div className="space-y-1">
              <span className="text-muted-foreground">Timestamps</span>
              <div className="grid gap-1 font-mono">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{formatTime(task.createdAt)}</span>
                </div>
                {task.startedAt && (
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span>{formatTime(task.startedAt)}</span>
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span>{formatTime(task.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {task.params && (
              <div className="space-y-1 sm:col-span-2">
                <span className="text-muted-foreground">Parameters</span>
                <code className="block w-full rounded bg-muted p-2 font-mono text-[10px] break-all">
                  {task.params}
                </code>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground sm:col-span-2">
              <span className="font-mono">ID: {task.id}</span>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const { schedule, status, eventTime, runTime } = entry
  const scheduleTimezone = schedule.timezone ?? timezone
  const isPostponed = status === 'POSTPONED'

  return (
    <AccordionItem
      value={entry.id}
      className={cn(
        'group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50',
        isPostponed && 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <AccordionTrigger className="px-3 py-2 hover:no-underline [&[data-state=open]]:bg-accent/50">
        <div className="flex w-full items-center gap-3">
          <TaskStatusBadge status={status} iconOnly />
          <div className="flex flex-1 flex-col items-start gap-0.5 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium leading-none">
                {formatTaskType(schedule.type)}
              </span>
              {isPostponed && (
                <Badge
                  variant="outline"
                  className="h-4 border-amber-500/50 px-1 text-[10px] text-amber-600 dark:text-amber-400"
                >
                  Postponed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{formatTime(eventTime)}</span>
              <span>·</span>
              <span>Scheduled</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                disabled={isBusy}
              >
                {isBusy ? <Spinner className="size-4" /> : <MoreVertical className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPostponed ? (
                <DropdownMenuItem onSelect={() => onResume(schedule.id)} disabled={isBusy}>
                  <RotateCcw className="mr-2 size-4" />
                  Restore next run
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onPostpone(schedule.id)} disabled={isBusy}>
                  <Pause className="mr-2 size-4" />
                  Skip next run
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(schedule.id)}
                disabled={isBusy}
              >
                <Trash2 className="mr-2 size-4" />
                Delete schedule
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t bg-muted/20 px-3 py-3">
        <div className="grid gap-4 text-xs sm:grid-cols-2">
          {isPostponed && (
            <div className="col-span-full rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              This occurrence has been postponed. Restore it to re-enable the next run.
            </div>
          )}

          <div className="space-y-1">
            <span className="text-muted-foreground">Schedule Details</span>
            <div className="grid gap-1">
              <div className="flex justify-between">
                <span>Local time:</span>
                <span className="font-mono">{formatTime(eventTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>{scheduleTimezone}:</span>
                <span className="font-mono">
                  {runTime.toLocaleString(undefined, { timeStyle: 'short' })}
                </span>
              </div>
            </div>
          </div>

          {schedule.params && (
            <div className="space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Parameters</span>
              <code className="block w-full rounded bg-muted p-2 font-mono text-[10px] break-all">
                {schedule.params}
              </code>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-muted-foreground sm:col-span-2">
            <span className="font-mono">ID: {schedule.id}</span>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
