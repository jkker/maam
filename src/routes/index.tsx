import { createFileRoute } from '@tanstack/react-router'
import { CalendarIcon, ClockIcon, Home, TimerIcon, ZapIcon } from 'lucide-react'

import { CopyToClipboardExample } from '#/components/examples/copy-to-clipboard-example'
import { FormExample } from '#/components/examples/form-example'
import { TaskListExample } from '#/components/examples/task-list-example'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  getDaysUntil,
  isDueSoon,
  isOverdue,
} from '#/lib/temporal-utils'

export const Route = createFileRoute('/')({
  staticData: { title: 'Home', icon: Home },
  component: function ExamplesPage() {
    const now = Temporal.Now.plainDateTimeISO()
    const futureDate = now.add({ days: 5, hours: 3 })
    const pastDate = now.subtract({ days: 2, hours: 5 })
    const duration = Temporal.Duration.from({ hours: 2, minutes: 30, seconds: 45 })

    return (
      <article className="container mx-auto space-y-8 p-6">
        <header>
          <h1 className="mb-2 text-4xl font-bold">Examples</h1>
          <p className="text-lg">
            Demonstrations of temporal-polyfill, Drawer component, and Zustand state management
          </p>
        </header>

        <main className="grid gap-8 lg:grid-cols-2">
          <TaskListExample />
          <Card className="relative w-full pt-0">
            <Skeleton className="relative aspect-video w-full rounded-b-none object-cover brightness-60 grayscale dark:brightness-40" />
            <CardHeader>
              <CardAction>
                <Badge variant="secondary">Featured</Badge>
              </CardAction>
              <CardTitle>Design systems meetup</CardTitle>
              <CardDescription>
                A practical talk on component APIs, accessibility, and shipping faster.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full">View Event</Button>
            </CardFooter>
          </Card>
          <CopyToClipboardExample />
          <FormExample />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Temporal API Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="flex items-center gap-2 font-semibold">
                  <ClockIcon className="h-4 w-4" />
                  Date/Time Formatting
                </p>
                <div className="space-y-1 pl-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Full format:</span>
                    <span className="font-mono">{formatDateTime(now, 'full')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Long format:</span>
                    <span className="font-mono">{formatDateTime(now, 'long')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Short format:</span>
                    <span className="font-mono">{formatDateTime(now, 'short')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 font-semibold">
                  <ZapIcon className="h-4 w-4" />
                  Relative Time
                </p>
                <div className="space-y-1 pl-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">5 days from now:</span>
                    <span className="font-mono">{formatRelativeTime(futureDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">2 days ago:</span>
                    <span className="font-mono">{formatRelativeTime(pastDate)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 font-semibold">
                  <TimerIcon className="h-4 w-4" />
                  Duration & Time Helpers
                </p>
                <div className="space-y-1 pl-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration (2h 30m 45s):</span>
                    <span className="font-mono">{formatDuration(duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days until 5 days from now:</span>
                    <span className="font-mono">{getDaysUntil(futureDate)} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Is 5 days from now overdue?</span>
                    <span className="font-mono">{isOverdue(futureDate) ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Is 5 days from now due soon?</span>
                    <span className="font-mono">{isDueSoon(futureDate, 7) ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold">Number & Currency Formatting</p>
                <div className="space-y-1 pl-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency ($1,234.56):</span>
                    <span className="font-mono">{formatCurrency(1234.56)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decimal (3.14159):</span>
                    <span className="font-mono">{formatNumber(Math.PI, 4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Percent (75.5%):</span>
                    <span className="font-mono">{formatPercent(75.5)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Technical Implementation Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 font-semibold">Zustand State Management</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Strict TypeScript interfaces for type safety</li>

                  <li>External mutations declared outside store</li>
                  <li>
                    Sparse updates with{' '}
                    <code className="rounded bg-muted px-1 font-mono text-xs">setState()</code>
                  </li>
                  <li>Computed selectors for derived state</li>
                  <li>Arktype runtime validation for inputs</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 font-semibold">Drawer Component</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Sheet-style drawer for mobile-first design</li>
                  <li>Controlled open/close state</li>
                  <li>Smooth animations with Tailwind</li>
                  <li>Accessible with proper ARIA attributes</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 font-semibold">Temporal Polyfill</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Temporal API for modern date/time handling</li>
                  <li>Intl.DateTimeFormat for localized formatting</li>
                  <li>Intl.RelativeTimeFormat for human-readable times</li>
                  <li>Intl.DurationFormat for duration representation</li>
                  <li>Intl.NumberFormat for numbers and currency</li>
                  <li>
                    Immutable operations with{' '}
                    <code className="rounded bg-muted px-1 font-mono text-xs">Temporal</code> types
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </main>
      </article>
    )
  },
})
