import type { ScheduleData, TaskType } from '@maam/server'
import type { CalendarConfig, CalendarEvent } from '@schedule-x/calendar'

import { TASK_TYPE, ARKNIGHTS_TIME_ZONE } from '@maam/server/const'
import { createViewDay, createViewWeek, createViewList } from '@schedule-x/calendar'
import { createCurrentTimePlugin } from '@schedule-x/current-time'

import {
  createEventRecurrencePlugin,
  createEventsServicePlugin,
} from '@schedule-x/event-recurrence'

import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarIcon, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import 'temporal-polyfill/global'

import { useTheme } from '@/hooks/useTheme'
import { cn, formatTaskType, formatTime } from '@/utils'

import { queryClient, trpc } from '../lib/trpc'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Spinner } from './ui/spinner'

const queryKey = trpc.schedule.get.queryKey()

const browserTz = Temporal.Now.timeZoneId()

export const ScheduleManager = ({
  className,
  connected,
}: {
  className?: string
  connected?: boolean
}) => {
  const { resolvedTheme } = useTheme()

  const [datetimeToAdd, setDateTimeToAdd] = useState<Temporal.ZonedDateTime>()
  const [scheduleIdToEdit, setScheduleIdEdit] = useState<string>()

  const { data: schedules = [] } = useQuery(trpc.schedule.get.queryOptions())
  const { data: officialEvents = [] } = useQuery(
    trpc.eventCalendar.queryOptions(undefined, {
      refetchInterval: 1000 * 60 * 60, // 60 minutes
    }),
  )

  const calendar = useCalendarApp(
    {
      views: [createViewDay(), createViewWeek(), createViewList()],
      defaultView: 'day',
      theme: 'shadcn',
      isDark: resolvedTheme === 'dark',
      timezone: browserTz as CalendarConfig['timezone'],
      locale: 'en-US',
      firstDayOfWeek: 1, // Monday
      weekOptions: {
        gridHeight: 700,
      },
      calendars: {
        tasks: {
          colorName: 'tasks',
          lightColors: {
            main: 'var(--color-blue-500)',
            container: 'var(--color-blue-100)',
            onContainer: 'var(--color-blue-900)',
          },
          darkColors: {
            main: 'var(--color-blue-600)',
            container: 'var(--color-blue-900)',
            onContainer: 'var(--color-blue-100)',
          },
        },
        official: {
          colorName: 'official',
          lightColors: {
            main: 'var(--color-rose-500)',
            container: 'var(--color-rose-100)',
            onContainer: 'var(--color-rose-900)',
          },
          darkColors: {
            main: 'var(--color-rose-500)',
            container: 'var(--color-rose-900)',
            onContainer: 'var(--color-rose-100)',
          },
        },
        separator: {
          colorName: 'separator',
          lightColors: {
            main: 'var(--color-yellow-500)',
            container: 'var(--color-yellow-100)',
            onContainer: 'var(--color-yellow-900)',
          },
          darkColors: {
            main: 'var(--color-yellow-500)',
            container: 'var(--color-yellow-900)',
            onContainer: 'var(--color-yellow-100)',
          },
        },
      },
      events: [],
      callbacks: {
        onEventClick({ id, calendarId }) {
          if (calendarId === 'tasks') {
            setScheduleIdEdit(String(id))
          }
        },
        onClickDateTime(dateTime) {
          setDateTimeToAdd(dateTime)
        },
      },
    },
    [createEventRecurrencePlugin(), createEventsServicePlugin(), createCurrentTimePlugin()],
  )

  // Update calendar events when data changes or timezone changes
  useEffect(() => {
    if (!calendar?.events) return
    const now = Temporal.Now.zonedDateTimeISO()
    const separator = now.withTimeZone(ARKNIGHTS_TIME_ZONE).withPlainTime('04:00:00')

    const allEvents: CalendarEvent[] = [
      // Add new day separator
      {
        id: 'NEW_DAY_SEPARATOR',
        title: '🌅 New Day',
        start: separator,
        end: separator,
        rrule: 'FREQ=DAILY',
        calendarId: 'separator',
        _options: {
          disableDND: true,
          disableResize: true,
          additionalClasses: ['min-h-6'],
        },
      },
      // Add scheduled tasks
      ...schedules.map((schedule) => {
        const { hour, minute, id, type } = schedule
        const startTime = now.withPlainTime({
          hour,
          minute: minute ?? 0,
        })

        return {
          id,
          title: formatTaskType(type),
          start: startTime,
          end: startTime.add({ minutes: 30 }),
          rrule: 'FREQ=DAILY', // Daily recurring
          calendarId: 'tasks',
          _options: {
            disableDND: true,
            disableResize: true,
            additionalClasses: ['min-h-6 cursor-pointer'],
          },
        }
      }),
      // Add official events
      ...officialEvents.map(({ name, time }) => {
        const startTime = Temporal.ZonedDateTime.from(time)

        return {
          id: name,
          title: `🎮 ${name}`,
          start: startTime,
          end: startTime.add({ minutes: 30 }),
          calendarId: 'official',
          _options: {
            disableDND: true,
            disableResize: true,
            additionalClasses: ['min-h-6'],
          },
        }
      }),
    ]

    calendar.events.set(allEvents)
  }, [schedules, officialEvents, calendar])

  return (
    <Card className={cn('pb-0 gap-0', className)}>
      <CardHeader>
        <CardTitle>
          <CalendarIcon />
          Schedule
          <Button
            className="ml-auto"
            onClick={() => setDateTimeToAdd(Temporal.Now.zonedDateTimeISO())}
            size="icon"
            variant="secondary"
            disabled={!connected}
            title={connected ? 'Add Schedule' : 'Server connection required'}
          >
            <Plus />
          </Button>
        </CardTitle>
      </CardHeader>

      <div className="pr-4">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>

      {datetimeToAdd && (
        <AddScheduleDialog
          onClose={() => setDateTimeToAdd(undefined)}
          initialDateTime={datetimeToAdd}
        />
      )}

      {scheduleIdToEdit && (
        <EditScheduleDialog
          schedule={schedules.find((s) => s.id === scheduleIdToEdit)!}
          onClose={() => setScheduleIdEdit(undefined)}
        />
      )}
    </Card>
  )
}

function AddScheduleDialog({
  onClose,
  initialDateTime,
}: {
  onClose: () => void
  initialDateTime: Temporal.ZonedDateTime | undefined
}) {
  const [task, setTask] = useState<TaskType>('LinkStart')
  const [time, setTime] = useState(() => {
    if (initialDateTime) {
      const hour = initialDateTime.hour.toString().padStart(2, '0')
      const minute = initialDateTime.minute.toString().padStart(2, '0')
      return `${hour}:${minute}`
    }
    return '08:00'
  })

  const addMutation = useMutation(
    trpc.schedule.add.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey })
        onClose()
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const [hour, minute] = time.split(':').map(Number)
    addMutation.mutate({ task, hour, minute, timezone: browserTz })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-type">Task Type</Label>
            <Select value={task} onValueChange={(value) => setTask(value as TaskType)}>
              <SelectTrigger id="task-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatTaskType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
          <DialogFooter className="w-full grid grid-cols-2 gap-4">
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && <Spinner />}
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Schedule Dialog
function EditScheduleDialog({
  schedule,
  onClose,
}: {
  schedule: ScheduleData
  onClose: () => void
}) {
  const removeMutation = useMutation(
    trpc.schedule.remove.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey })
        onClose()
      },
    }),
  )

  const handleDelete = () => removeMutation.mutate(schedule.id)

  const timeStr = `${schedule.hour.toString().padStart(2, '0')}:${(schedule.minute ?? 0).toString().padStart(2, '0')}`

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Task Type</Label>
            <div className="text-sm font-medium">{formatTaskType(schedule.type)}</div>
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="text-sm font-medium">{timeStr}</div>
          </div>
          <div className="space-y-2">
            <Label>Statistics</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              {schedule.lastRunTime && <div>Last run: {formatTime(schedule.lastRunTime)}</div>}
              {schedule.runCount !== undefined && schedule.runCount > 0 && (
                <div>Total runs: {schedule.runCount}</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="w-full grid grid-cols-2 gap-4">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
