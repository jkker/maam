import { Badge } from '#/components/ui/badge'
import { ScrollArea } from '#/components/ui/scroll-area'
import type { EventHistoryItem } from '#/lib/api/instance'

interface EventTimelineProps {
  events: EventHistoryItem[]
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString()
}

function getEventBadgeVariant(
  eventType: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (eventType.includes('Completed') || eventType.includes('Success')) {
    return 'default'
  }
  if (eventType.includes('Failed') || eventType.includes('Aborted') || eventType.includes('Lost')) {
    return 'destructive'
  }
  if (eventType.includes('Lock') || eventType.includes('Pause')) {
    return 'secondary'
  }
  return 'outline'
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No events yet
      </div>
    )
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 p-2">
        {events.map((event) => (
          <div key={event.seq} className="flex items-start gap-3 rounded-md bg-muted/50 p-2">
            <span className="shrink-0 text-xs text-muted-foreground">{formatTime(event.at)}</span>
            <Badge variant={getEventBadgeVariant(event.type)} className="shrink-0">
              {event.type}
            </Badge>
            {event.data != null && typeof event.data === 'object' && (
              <span className="truncate text-xs text-muted-foreground">
                {String(JSON.stringify(event.data)).slice(0, 50)}
              </span>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
