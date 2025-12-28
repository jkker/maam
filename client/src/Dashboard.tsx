import { STAGE_OPTIONS } from '@maam/server/const'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  Check,
  Copy,
  LockIcon,
  Play,
  Plus,
  Settings2,
  SettingsIcon,
  Square,
  Terminal,
  UnlockIcon,
} from 'lucide-react'

import { useState } from 'react'
import { toast } from 'sonner'
import { Temporal } from 'temporal-polyfill'

import { Autocomplete } from '@/components/ui/autocomplete'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { InputGroup, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, formatTaskType } from '@/lib/utils'

import { Analytics } from './components/Analytics'
import { ScheduleManager } from './components/ScheduleManager'
import { TaskManager } from './components/TaskManager'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './components/ui/accordion'

import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './components/ui/empty'
import { Field, FieldLabel } from './components/ui/field'
import { ScrollArea } from './components/ui/scroll-area'
import { Skeleton } from './components/ui/skeleton'
import { Spinner } from './components/ui/spinner'
import { UserMenu } from './components/UserMenu'
import { Footer, Header } from './Layout'
import { useAuthStore } from './lib/auth-store'
import { invalidateQueries, useRPC } from './lib/orpc'

export default function Dashboard() {
  const { orpc, isAuthenticated } = useRPC()
  const {
    data: locked = false,
    isSuccess,
    isError,
    isPending,
    isFetching,
  } = useQuery(orpc.locked.queryOptions({ input: undefined, enabled: isAuthenticated }))

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

        <Analytics className="col-span-full" />

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
  const { user, device } = useAuthStore()

  const urls = {
    'Get Task': baseURL + '/maa/getTask',
    'Report Status': baseURL + '/maa/reportStatus',
    'Device Log Webhook': `${baseURL}/maa/deviceLog?device=${device}&user=${user}`,
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
          <Field key={label} className="gap-2">
            <FieldLabel htmlFor={url}>{label}</FieldLabel>
            <InputGroup
              onClick={async (e: React.MouseEvent) => {
                e.currentTarget.getElementsByTagName('input')[0]?.select()
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(url)
                  setTimeout(() => setCopied(undefined), 2000)
                } catch {
                  toast.error('Failed to copy to clipboard')
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
  const { orpc } = useRPC()
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const start = useMutation(orpc.start.mutationOptions({ onSuccess: () => invalidateQueries() }))
  const stop = useMutation(orpc.stop.mutationOptions({ onSuccess: () => invalidateQueries() }))

  const dispatch = useMutation(
    orpc.dispatch.mutationOptions({
      onSuccess: () => {
        void invalidateQueries()
        setStagePopoverOpen(false)
        setSelectedStage(null)
      },
    }),
  )

  return (
    <div className="grid grid-cols-2 sm:flex gap-2">
      {/* Start Button */}
      <Button
        onClick={() => start.mutate(undefined)}
        disabled={locked || !connected || start.isPending}
        className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 sm:flex-1"
        size="lg"
      >
        <Play className="size-4" />
        <span className="sm:inline">{start.isPending ? 'Starting...' : 'Start'}</span>
      </Button>

      {/* Stop Button */}
      <Button
        onClick={() => stop.mutate(undefined)}
        disabled={!connected || stop.isPending}
        variant="outline"
        size="lg"
        className="inline-flex items-center justify-center gap-2 font-medium sm:flex-1"
      >
        <Square className="size-4" />
        <span>{stop.isPending ? 'Stopping...' : 'Stop'}</span>
      </Button>

      {/* Task Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!connected}>
          <Button
            size="lg"
            className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 sm:flex-1"
          >
            <Plus className="size-4" />
            <span>Task</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 min-w-fit">
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
            <Settings2 className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-80 space-y-4">
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

  const { screenshotURL } = useRPC()

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
            src={screenshotURL}
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

function LockToggle({
  locked,
  connected,
  className,
}: {
  locked: boolean
  connected: boolean
  className?: string
}) {
  const { orpc } = useRPC()
  const { variables, mutate, isPending } = useMutation(
    orpc.toggleLock.mutationOptions({
      onSettled: () => invalidateQueries({ queryKey: orpc.locked.queryKey() }),
      onSuccess: (data) => (data.success ? toast.success : toast.error)(data.message),
      onError: (error) =>
        toast.error(locked ? 'Unlock Failed' : 'Lock Failed', { description: error.message }),
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
  const { orpc, isAuthenticated } = useRPC()
  // Use live query options for real-time log updates via event iterator
  const { data: logs = [] } = useQuery(
    orpc.deviceLog.experimental_liveOptions({
      input: undefined,
      retry: true, // Infinite retry for reliable streaming
      enabled: isAuthenticated,
    }),
  )

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>
          <Terminal />
          Logs
        </CardTitle>
      </CardHeader>
      <ScrollArea className="max-h-[50svh] md:max-h-[500px] w-full pr-4 overflow-auto">
        <CardContent>
          <Accordion type="multiple">
            {logs.length === 0 ? (
              <Empty>
                <EmptyDescription>No logs available</EmptyDescription>
              </Empty>
            ) : (
              logs.map((log, idx) => {
                // Use the first line as the title, truncated if too long
                const firstLine = log.split('\n')[0]
                const title = firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine

                return (
                  <AccordionItem
                    key={idx}
                    value={idx.toString()}
                    className="text-xs whitespace-pre-wrap"
                  >
                    <AccordionTrigger className="font-normal py-2 text-left font-mono">
                      {title}
                    </AccordionTrigger>
                    <AccordionContent className="font-mono text-muted-foreground whitespace-pre-wrap text-[0.75rem]">
                      {log.trim()}
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
