import { Badge } from '#/components/ui/badge'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { RunHistoryItem } from '#/lib/api/instance'

interface RunHistoryProps {
  runs: RunHistoryItem[]
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString()
}

function getStatusBadge(status: string | null, state: string) {
  if (status === 'SUCCESS') {
    return <Badge variant="default">Success</Badge>
  }
  if (status === 'FAILED') {
    return <Badge variant="destructive">Failed</Badge>
  }
  if (state === 'DISPATCHED') {
    return <Badge variant="secondary">Running</Badge>
  }
  if (state === 'PENDING_DISPATCH') {
    return <Badge variant="outline">Pending</Badge>
  }
  if (state === 'ABORTING') {
    return <Badge variant="destructive">Aborting</Badge>
  }
  return <Badge variant="outline">{state}</Badge>
}

export function RunHistory({ runs }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No run history yet
      </div>
    )
  }

  return (
    <ScrollArea className="h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Finished</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.run_id}>
              <TableCell className="font-mono text-xs">{run.run_id.slice(0, 16)}...</TableCell>
              <TableCell>{getStatusBadge(run.status, run.state)}</TableCell>
              <TableCell className="text-sm">{formatDate(run.created_at)}</TableCell>
              <TableCell className="text-sm">{formatDate(run.finished_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
