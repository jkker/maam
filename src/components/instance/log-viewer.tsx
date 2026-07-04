import { ScrollArea } from '#/components/ui/scroll-area'
import type { LogEntry } from '#/lib/api/instance'

interface LogViewerProps {
  logs: LogEntry[]
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString()
}

export function LogViewer({ logs }: LogViewerProps) {
  if (logs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No logs yet
      </div>
    )
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="bg-muted/30 font-mono text-xs">
        {logs.map((log) => (
          <div key={log.seq} className="flex gap-2 border-b px-2 py-1">
            <span className="shrink-0 text-muted-foreground">{formatTime(log.at)}</span>
            <pre className="whitespace-pre-wrap">{log.text}</pre>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
