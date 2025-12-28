import { formatDuration } from '@maam/server/lib/temporal'
import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Temporal } from 'temporal-polyfill'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRPC } from '@/lib/orpc'
import { cn, formatTaskType } from '@/lib/utils'

export function Analytics({ className }: { className?: string }) {
  const { orpc, isAuthenticated } = useRPC()
  const { data: stats } = useQuery(
    orpc.stats.queryOptions({
      input: undefined,
      enabled: isAuthenticated,
    }),
  )

  if (!stats) return null

  const { overview, recent } = stats

  const successRate = overview.total > 0 ? (overview.success / overview.total) * 100 : 0

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.total}</div>
          <p className="text-xs text-muted-foreground">{overview.cancelled} cancelled</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(successRate)}%</div>
          <p className="text-xs text-muted-foreground">{overview.success} successful</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Tasks</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.failed}</div>
          <p className="text-xs text-muted-foreground">
            {(overview.total > 0 ? (overview.failed / overview.total) * 100 : 0).toFixed(1)}%
            failure rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(Temporal.Duration.from({ milliseconds: overview.avgDuration }))}
          </div>
          <p className="text-xs text-muted-foreground">per successful task</p>
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-4">
              {recent.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent activity</div>
              ) : (
                recent
                  .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
                  .map((task, i) => (
                    <div key={i} className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {formatTaskType(task.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(task.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'ml-auto font-medium text-xs',
                          task.stage === 'DONE' &&
                            task.status !== 'FAILED' &&
                            task.status !== 'CANCELLED'
                            ? 'text-green-500'
                            : task.status === 'FAILED'
                              ? 'text-red-500'
                              : task.status === 'CANCELLED'
                                ? 'text-yellow-500'
                                : 'text-blue-500',
                        )}
                      >
                        {task.status || task.stage}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
