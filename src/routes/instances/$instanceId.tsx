import { createFileRoute } from '@tanstack/react-router'

import { EventTimeline } from '#/components/instance/event-timeline'
import { LogViewer } from '#/components/instance/log-viewer'
import { RunHistory } from '#/components/instance/run-history'
import { SchedulePolicyInfo, StatusCard } from '#/components/instance/status-card'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  useInstanceEvents,
  useInstanceLogs,
  useInstanceRuns,
  useInstanceState,
} from '#/hooks/use-instance'

export const Route = createFileRoute('/instances/$instanceId')({
  component: InstanceDashboard,
})

function InstanceDashboard() {
  const params = Route.useParams() as { instanceId: string }
  const decodedId = decodeURIComponent(params.instanceId)

  const stateQuery = useInstanceState(decodedId)
  const runsQuery = useInstanceRuns(decodedId)
  const eventsQuery = useInstanceEvents(decodedId)
  const logsQuery = useInstanceLogs(decodedId)

  if (stateQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (stateQuery.error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Error loading instance</h2>
        <p className="text-muted-foreground">{stateQuery.error.message}</p>
      </div>
    )
  }

  const state = stateQuery.data!

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Status Card */}
      <StatusCard instanceId={decodedId} state={state} />

      {/* Schedule Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <SchedulePolicyInfo state={state} />
        </CardContent>
      </Card>

      {/* Tabs for History/Events/Logs */}
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardContent className="pt-6">
              {runsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner />
                </div>
              ) : runsQuery.error ? (
                <p className="text-center text-destructive">Failed to load runs</p>
              ) : (
                <RunHistory runs={runsQuery.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="pt-6">
              {eventsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner />
                </div>
              ) : eventsQuery.error ? (
                <p className="text-center text-destructive">Failed to load events</p>
              ) : (
                <EventTimeline events={eventsQuery.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="pt-6">
              {logsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner />
                </div>
              ) : logsQuery.error ? (
                <p className="text-center text-destructive">Failed to load logs</p>
              ) : (
                <LogViewer logs={logsQuery.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
