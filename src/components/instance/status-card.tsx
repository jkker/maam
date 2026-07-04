import { Clock, Lock, Pause, Play, RefreshCw, Square, Unlock } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  useAbortRun,
  usePauseAutomation,
  useReleaseLockLease,
  useResumeAutomation,
  useRunNow,
} from '#/hooks/use-instance'
import type { InstanceState } from '#shared/domain/state'

interface StatusCardProps {
  instanceId: string
  state: InstanceState
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Formats an ISO date string to relative time.
 */
function formatRelative(isoString: string): string {
  const date = new Date(isoString)
  const now = Date.now()
  const diff = date.getTime() - now

  if (diff > 0) {
    // Future
    return `in ${formatDuration(diff)}`
  }
  // Past
  return `${formatDuration(-diff)} ago`
}

/**
 * Gets the primary blocker reason for the instance.
 */
function getBlockerReason(state: InstanceState): string | null {
  if (state.paused) {
    return state.pauseReason ?? 'Automation paused'
  }
  if (state.lockLease) {
    const expiresIn = new Date(state.lockLease.expiresAt).getTime() - Date.now()
    if (expiresIn > 0) {
      return `Locked (expires ${formatRelative(state.lockLease.expiresAt)})`
    }
  }
  if (state.cooldownUntil) {
    const cooldownEnd = new Date(state.cooldownUntil).getTime()
    if (cooldownEnd > Date.now()) {
      return `Cooldown (ends ${formatRelative(state.cooldownUntil)})`
    }
  }
  return null
}

/**
 * Gets the run state badge variant.
 */
function getRunStateBadge(runState: string): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  label: string
} {
  switch (runState) {
    case 'PENDING_DISPATCH':
      return { variant: 'secondary', label: 'Pending' }
    case 'DISPATCHED':
      return { variant: 'default', label: 'Running' }
    case 'ABORTING':
      return { variant: 'destructive', label: 'Aborting' }
    default:
      return { variant: 'outline', label: runState }
  }
}

export function StatusCard({ instanceId, state }: StatusCardProps) {
  const runNow = useRunNow(instanceId)
  const abortRun = useAbortRun(instanceId)
  const releaseLock = useReleaseLockLease(instanceId)
  const pause = usePauseAutomation(instanceId)
  const resume = useResumeAutomation(instanceId)

  const blocker = getBlockerReason(state)
  const hasActiveRun = !!state.currentRun
  const isLocked = !!state.lockLease

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{state.instanceId}</CardTitle>
            <CardDescription>
              Task: {state.taskTemplate.maaTaskType}
              {state.taskTemplate.params && ` (${state.taskTemplate.params})`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {state.paused && (
              <Badge variant="secondary">
                <Pause className="mr-1 size-3" />
                Paused
              </Badge>
            )}
            {isLocked && (
              <Badge variant="destructive">
                <Lock className="mr-1 size-3" />
                Locked
              </Badge>
            )}
            {hasActiveRun && (
              <Badge variant={getRunStateBadge(state.currentRun!.state).variant}>
                {getRunStateBadge(state.currentRun!.state).label}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blocker Alert */}
        {blocker && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">{blocker}</p>
          </div>
        )}

        {/* Schedule Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last run:</span>
            <span>{state.lastFinishAt ? formatRelative(state.lastFinishAt) : 'Never'}</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next wake:</span>
            <span>{state.nextWakeAt ? formatRelative(state.nextWakeAt) : 'Not scheduled'}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || hasActiveRun || !!blocker}
          >
            <Play className="mr-1 size-4" />
            Run Now
          </Button>

          {hasActiveRun && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => abortRun.mutate()}
              disabled={abortRun.isPending || state.currentRun?.state === 'ABORTING'}
            >
              <Square className="mr-1 size-4" />
              Abort
            </Button>
          )}

          {isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => releaseLock.mutate()}
              disabled={releaseLock.isPending}
            >
              <Unlock className="mr-1 size-4" />
              Release Lock
            </Button>
          )}

          {state.paused ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => resume.mutate()}
              disabled={resume.isPending}
            >
              <Play className="mr-1 size-4" />
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => pause.mutate('Manual pause')}
              disabled={pause.isPending}
            >
              <Pause className="mr-1 size-4" />
              Pause
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface SchedulePolicyInfoProps {
  state: InstanceState
}

export function SchedulePolicyInfo({ state }: SchedulePolicyInfoProps) {
  const policy = state.schedulePolicy

  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
      <div>
        <span className="text-muted-foreground">Soft interval:</span>{' '}
        {formatDuration(policy.softIntervalMs)}
      </div>
      <div>
        <span className="text-muted-foreground">Hard interval:</span>{' '}
        {formatDuration(policy.hardIntervalMs)}
      </div>
      <div>
        <span className="text-muted-foreground">Unlock delay:</span>{' '}
        {formatDuration(policy.postUnlockDelayMs)}
      </div>
      <div>
        <span className="text-muted-foreground">Lock lease:</span>{' '}
        {formatDuration(policy.lockLeaseMs)}
      </div>
      <div>
        <span className="text-muted-foreground">Skip window:</span>{' '}
        {formatDuration(policy.skipIfNextRunWithinMs)}
      </div>
    </div>
  )
}
