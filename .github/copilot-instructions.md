## Project Overview

This is a **pnpm monorepo** implementing a web server and dashboard for the [MAA (MaaFramework) remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html). The project consists of two packages:

- **@maam/server**: Hono-based HTTP server with tRPC API implementing MAA protocol endpoints (`server/src/`)
- **@maam/client**: React dashboard using shadcn/ui components for managing tasks and schedules (`client/src/`)

The server acts as a remote control endpoint for MAA client applications, managing task dispatch, scheduling, and authorization. Real-time updates are delivered via Server-Sent Events (SSE) through tRPC subscriptions.

## Architecture & Key Files

### Server Package (`server/src/`)

- **`index.ts`**: Main application entry point
  - Defines tRPC router with procedures for all dashboard operations
  - Exports `TRPCRouter` type for client-side type inference
  - Implements HTTP endpoints for MAA protocol compliance (`/maa/*`)
  - Exports `app` (Hono instance) and default `manager` (MaaManager instance)
  - Uses `@hono/trpc-server` middleware for tRPC integration with SSE support
- **`server.ts`**: Production server entry using `@hono/node-server`, listens on `0.0.0.0:3113`

- **`MaaManager.ts`**: Core orchestration class
  - Manages `tasks: Map<id, Task>` - all task instances
  - Manages `queue: Task[]` - pending tasks awaiting MAA client polling
  - Manages `scheduler: ToadScheduler` - cron job engine
  - Manages `schedules: TaskSchedule[]` - active schedule instances
  - Manages `logs: string[]` - device log buffer (max 100 entries)
  - Provides `listen(event, options)` method for SSE-compatible async generators
  - Emits `'update'` event on task state changes (via `EventEmitter`)
  - Emits `'screenshot'` event when `CaptureImageNow` task completes
  - Emits `'deviceLog'` event when MAA client sends logs
- **`lib/schema.ts`**: Zod schemas and TypeScript types
  - `TASK_TYPE` - Array of all supported task types
  - `IMMEDIATE_TASK` - Subset of synchronous task types (`HeartBeat`, `StopTask`, `CaptureImageNow`)
  - `TASK_STAGE`, `TASK_STATUS` - Enums for task lifecycle states
  - `reportSchema`, `deviceSchema`, `scheduleSchema`, `taskSchema` - Validation schemas
  - Types: `TaskData`, `TaskType`, `ImmediateTask`, `TaskStage`, `Schedule`, `ScheduleData`
- **`lib/logger.ts`**: Logging utilities using `tslog` with file rotation via `rotating-file-stream`

- **`lib/temporal.ts`**: Temporal API utilities for timezone-aware datetime handling

- **`lib/prts.wiki.ts`**: Web scraper using `cheerio` to fetch official Arknights events from PRTS Wiki

### Client Package (`client/src/`)

- **`main.tsx`**: React app entry point
  - Wraps app in `QueryClientProvider` (TanStack Query)
  - Provides `ThemeProvider` for dark mode support
  - Renders `Dashboard` component and `Toaster` (Sonner notifications)
- **`Dashboard.tsx`**: Main dashboard component
  - Uses `useSubscription` for real-time task/log updates via SSE
  - Uses `useQuery` for screenshot, lock state, and heartbeat polling
  - Uses `useMutation` for task dispatch, lock toggle
  - Renders all dashboard sections: screenshot, quick actions, tasks, logs, schedule, stats, config
- **`Layout.tsx`**: Header and footer components with responsive navigation

- **`components/ScheduleManager.tsx`**: Calendar integration
  - Uses `@schedule-x/calendar` with React hooks (`useCalendarApp`)
  - Implements `ScheduleXCalendar` with daily/weekly/list views
  - Integrates with tRPC for schedule CRUD operations
  - Displays official events from `prts.wiki.ts` alongside user schedules
  - Uses shadcn/ui Dialog for add/edit schedule forms
- **`components/ui/`**: shadcn/ui components
  - Radix UI primitives styled with Tailwind
  - Components: `accordion`, `alert`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `field`, `form`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `skeleton`, `sonner`, `spinner`, `switch`, `tabs`, `textarea`, `toggle`
  - Configured via `client/components.json` (New York style, Lucide icons)
- **`lib/trpc.ts`**: tRPC client configuration
  - Creates `trpcClient` with `splitLink` for SSE subscriptions vs HTTP batch requests
  - Exports `trpc` options proxy for type-safe query/mutation/subscription hooks
  - Exports `queryClient` (TanStack Query instance)
- **`utils.ts`**: Utility functions
  - `formatDuration(ms)` - Formats duration in human-readable units
  - `formatTime(timestamp)` - Formats ISO 8601 to locale-aware datetime
  - `formatTaskType(type)` - Maps task types to Chinese display names
  - Re-exports `cn` from `lib/utils.ts` (Tailwind merge utility)
- **Builds to**: `server/dist/public/` (served as static assets via `serveStatic` middleware)

## tRPC Router Structure

The tRPC router in `server/src/index.ts` uses Server-Sent Events (SSE) for real-time subscriptions:

### Initialization

```ts
const t = initTRPC.context<VariablesContext>().create({
  sse: {
    ping: { enabled: true, intervalMs: 2_000 },
  },
})
```

### Procedures

#### Manager Control

- `start` (mutation) → calls `manager.start()` (creates `LinkStart` task)
- `stop` (mutation) → calls `manager.stop()` (creates `StopTask` immediate task)
- `heartbeat` (query) → creates `HeartBeat`, waits for `DONE`, returns boolean
- `isLocked` (query) → returns `manager.locked` boolean
- `toggleLock` (mutation) → input `boolean`, calls `manager.lock()` or `manager.unlock()`

#### Task Management

- `dispatch` (mutation) → input `{ task: TaskType, params?: string }`, creates task immediately
- `state` (subscription) → SSE stream, emits `{ tasks: TaskData[] }` on `manager` `'update'` events

#### Schedule Management

- `schedules` (query) → returns `manager.schedules.map(s => s.data)`
- `addSchedule` (mutation) → input `scheduleSchema`, calls `manager.addSchedule()`
- `removeSchedule` (mutation) → input `string` (schedule ID), calls `manager.removeSchedule()`
- `schedule.get` / `schedule.add` / `schedule.remove` → aliases for above

#### Screenshot & Logs

- `screenshot` (subscription) → SSE stream, emits base64 PNG on `'screenshot'` events
- `screenshotQuery` (query) → creates `CaptureImageNow`, waits for `DONE`, returns base64 PNG
- `deviceLog` (subscription) → SSE stream, yields last 50 logs, then emits on `'deviceLog'` events

#### Event Calendar

- `eventCalendar` (query) → fetches official Arknights events from PRTS Wiki via `fetchUpcomingEvents()`

### Client Usage Pattern

In `client/src/Dashboard.tsx` and `client/src/components/ScheduleManager.tsx`:

```tsx
// Queries (useQuery)
const { data, isLoading } = useQuery(trpc.heartbeat.queryOptions())
const { data: isLocked } = useQuery(trpc.isLocked.queryOptions())
const { data: schedules = [] } = useQuery(trpc.schedule.get.queryOptions())

// Mutations (useMutation)
const start = useMutation(trpc.start.mutationOptions({ onSuccess: ... }))
const dispatch = useMutation(trpc.dispatch.mutationOptions())
const addSchedule = useMutation(trpc.addSchedule.mutationOptions())

// Subscriptions (useSubscription) - SSE-based real-time updates
const { data: { tasks = [] } = {} } = useSubscription(trpc.state.subscriptionOptions())
const { data: logs = [] } = useSubscription(trpc.deviceLog.subscriptionOptions())
```

SSE subscriptions automatically reconnect on disconnect and maintain persistent connections for live updates.

### Task Lifecycle

Tasks are modeled by the `Task` class (extends `EventEmitter`) and transition through three stages:

1. **PENDING**: Task created and enqueued via `manager.create(type, params?)`
2. **RUNNING**: Task dequeued by MAA client via `/maa/getTask` endpoint
3. **DONE**: Task completed and reported via `/maa/reportStatus` endpoint

Stage transitions emit events with the same name. Use `task.waitFor(stage, duration?)` to await stage changes:

```ts
const task = manager.create('LinkStart')
await task.waitFor('RUNNING') // Waits for MAA client to poll
await task.waitFor('DONE', { minutes: 5 }) // Times out after 5 min
```

`Task.waitFor` throws `Task.TimeoutError` on timeout. Always wrap in try/catch when adding new flows.

### Immediate vs Queued Tasks

Tasks are classified into two execution modes:

- **Immediate tasks** (in `IMMEDIATE_TASK` array): Execute synchronously and wait for `DONE` before responding
  - Examples: `HeartBeat`, `StopTask`, `CaptureImageNow`
  - Block route handlers until completion, cleaned up immediately
- **Queued tasks**: Return after reaching `RUNNING`, MAA client polls and executes asynchronously
  - Examples: `LinkStart`, `CaptureImage`, `LinkStart-Combat`
  - Remain in `manager.tasks` map until explicitly removed

When adding new task types, update `IMMEDIATE_TASK` in `lib/schema.ts` if they should execute synchronously.

## MAA Remote Control Protocol

The server implements the [MAA remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html):

### Core Protocol Endpoints

- **`POST /maa/getTask`**: MAA client polls for pending tasks
  - Requires device/user authorization via `auth` middleware
  - Drains `manager.queue`, marks each task `RUNNING`, returns `{ tasks: [{ id, type, params? }] }`
- **`POST /maa/reportStatus`**: MAA client reports task completion
  - Payload: `{ task: id, status: 'SUCCESS'|'FAILED', payload?: base64string }`
  - Updates task stage to `DONE`, emits event to resolve waiting handlers

### Task Control Endpoints

- `GET /maa/health` → dispatches `HeartBeat` (immediate)
- `GET /maa/start` → dispatches `LinkStart` (queued)
- `GET /maa/stop` → dispatches `StopTask` (immediate)
- `GET /maa/screenshot` → dispatches `CaptureImageNow` (immediate), returns PNG binary

### Management Endpoints

- `GET /maa/state` → returns `{ locked, tasks[], schedules[] }`
- `GET /maa/lock` → locks manager (pauses schedules, blocks new queued tasks)
- `GET /maa/unlock` → unlocks manager (resumes schedules)
- `POST /maa/schedule` → creates cron schedule, returns `{ id }`
- `DELETE /maa/schedule/:id` → removes schedule by id

### Authorization

The `auth` middleware validates `device` and `user` fields using `deviceSchema`:

```ts
const auth = factory.createHandlers(zValidator('json', deviceSchema), async (c, next) => {
  const { device, user } = c.req.valid('json')
  const manager = managers.get(device)
  if (!manager || device !== manager.device || user !== manager.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('manager', manager)
  return next()
})
```

Use `...auth` spread in route definitions for endpoints that should only accept MAA client requests.

## Scheduling

Schedules are managed via `toad-scheduler` with cron expressions (`0 minute hour * * *`):

- `manager.addSchedule({ task, hour, minute?, timezone? })` → creates job, returns deterministic id like `LinkStart|3:15`
- `manager.removeSchedule(id)` → stops and removes job
- `scheduleSchema` defaults: `minute: 0`, `task: 'LinkStart'`, `timezone: manager.tz`
- Jobs automatically call `manager.create(task, params)` at scheduled times
- When manager is locked, all schedules are paused; unlocking resumes them

## MaaManager State

The `MaaManager` class maintains:

- `tasks: Map<id, Task>` - all active task instances
- `queue: Task[]` - pending tasks waiting to be polled
- `scheduler: ToadScheduler` - cron job manager
- `locked: boolean` - whether manager accepts new queued tasks
- `device`, `user` - authorization credentials
- `tz` - IANA timezone for task/schedule timestamps

Key methods:

- `create(type, params?)` → creates task with deterministic id `type|ISO8601timestamp`, enqueues it
- `addSchedule(schedule)` → registers cron job
- `removeSchedule(id)` → removes cron job
- `lock()` → sets locked, stops scheduler, clears queue, creates `StopTask`
- `unlock()` → clears locked, resumes all scheduled jobs
- `screenshot()` → convenience method that creates `CaptureImageNow`, waits for completion, returns Buffer

## Schemas & Types (`lib/schema.ts`)

Key exports:

- `TASK_TYPE`: Array of all supported MAA task type strings
- `IMMEDIATE_TASK`: Subset of immediate task types (`HeartBeat`, `StopTask`, `CaptureImageNow`)
- `TASK_STAGE`: `['PENDING', 'RUNNING', 'DONE']`
- `TASK_STATUS`: `['PENDING', 'FAILED', 'SUCCESS']`
- `reportSchema`, `deviceSchema`, `scheduleSchema`, `taskSchema`: Zod validation schemas
- Types: `TaskData`, `TaskType`, `ImmediateTask`, `TaskStage`, `Schedule`

When adding new task types, add to `TASK_TYPE` (and `IMMEDIATE_TASK` if synchronous).

## Type Safety & tRPC Integration

- Server exports `TRPCRouter` type from `server/src/index.ts` for client-side inference
- Client creates type-safe hooks via `createTRPCOptionsProxy<TRPCRouter>`
- Schemas in `@maam/server/schema` can be imported by external consumers
- Full end-to-end type safety: mutations, queries, and subscriptions are fully typed
- SSE subscriptions use `httpSubscriptionLink` with automatic type inference

### tRPC Client Setup

```tsx
// lib/trpc.ts
import { createTRPCClient, splitLink, httpBatchLink, httpSubscriptionLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

export const trpcClient = createTRPCClient<TRPCRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({ url: '/trpc' }), // SSE for subscriptions
      false: httpBatchLink({ url: '/trpc' }), // HTTP batch for queries/mutations
    }),
  ],
})

export const trpc = createTRPCOptionsProxy<TRPCRouter>({
  client: trpcClient,
  queryClient,
})
```

### Usage in Components

```tsx
// Type-safe query
const { data, isLoading, error } = useQuery(trpc.heartbeat.queryOptions())
// data is boolean | undefined, fully typed

// Type-safe mutation with onSuccess callback
const dispatch = useMutation(
  trpc.dispatch.mutationOptions({
    onSuccess: (data) => {
      // data.task is TaskData, fully typed
      queryClient.invalidateQueries()
    },
  }),
)
dispatch.mutate({ task: 'LinkStart', params: 'optional' })

// Type-safe SSE subscription
const { data: { tasks = [] } = {} } = useSubscription(trpc.state.subscriptionOptions())
// tasks is TaskData[], auto-updates via SSE
```

### Package Management

- Use **pnpm** (required) - `pnpm-lock.yaml` is authoritative
- Install: `pnpm install`
- This is a monorepo using `pnpm-workspace.yaml`

### Commands (from root)

- `pnpm dev` → starts both server (3113) and client (dev server) in parallel
- `pnpm build` → builds server and client packages
- `pnpm start` → runs production server (server must be built first)
- `pnpm test` → runs Vitest test suites
- `pnpm lint` → runs ESLint
- `pnpm format` → formats with Prettier
- `pnpm typecheck` → runs TypeScript compiler in all packages

### Server-specific Commands

From `server/` directory:

- `pnpm dev` → Vite dev server with HMR on port 3113
- `pnpm build` → builds to `dist/`, generates type declarations
- `pnpm start` → runs `node ./dist/server.js`

### Client-specific Commands

From `client/` directory:

- `pnpm dev` → Vite dev server (proxies API to localhost:3113)
- `pnpm build` → builds to `../server/dist/public/`
- `pnpm preview` → previews production build

### Pre-commit Hooks

Configured via `simple-git-hooks` and `lint-staged`:

1. `tsc --noEmit` - type checking
2. `eslint --fix` - linting with auto-fix
3. `prettier --write .` - formatting

Keep all changes type-safe and properly formatted to avoid hook failures.

## Testing

### Test Files

Current test coverage (75 tests passing):

- `server/src/test/task.test.ts` - Task class unit tests (33 tests)
- `server/src/test/router-public.test.ts` - Public oRPC procedures (7 tests)
- `server/src/test/manager.test.ts` - MaaManager with device fixture (13 tests)
- `server/src/test/assignment.test.ts` - Hungarian algorithm assignment (15 tests)
- `server/src/test/unlock-endpoint.test.ts` - HTTP unlock endpoint (7 tests)

### Testing Patterns

#### 1. oRPC Server-Side Testing

Use `call()` from `@orpc/server` to test procedures directly:

```ts
import { call } from '@orpc/server'

// Test public procedure
const result = await call(router.auth.login, {
  user: 'test-user',
  device: 'test-device-0123456789',
})

// Test protected procedure (requires context)
const result = await call(router.locked, undefined, { manager, user, device })
```

#### 2. Database Mocking

Mock database service to avoid file I/O in unit tests:

```ts
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  getTaskById: vi.fn().mockResolvedValue(null),
  getUserOrCreate: vi.fn().mockResolvedValue({ id: 'user', name: 'user' }),
  getDeviceOrCreate: vi.fn().mockResolvedValue({ id: 'device', user: 'user' }),
  validateDeviceOwnership: vi.fn().mockResolvedValue(true),
}))
```

#### 3. Device Fixtures

Use `MaaDeviceFixture` to simulate MAA client behavior:

```ts
import { createTestManager } from '../test/fixture'

const { manager, fixture } = createTestManager()
fixture.startPolling() // Start polling tasks automatically

// Wait for task completion
const completedTask = await fixture.waitForTask(task.id, 2000)

// Cleanup
fixture.stopPolling()
```

#### 4. Temporal API for Time-Based Testing

Use proper `Temporal.ZonedDateTime` for deterministic timestamps:

```ts
import { Temporal } from 'temporal-polyfill'

const createdAt = Temporal.ZonedDateTime.from('2025-11-10T12:00:00[UTC]')
const task = new Task('HeartBeat', createdAt)

// Freeze time if needed
vi.spyOn(Temporal.Now, 'instant').mockReturnValue(frozenInstant)
```

#### 5. Proper Resource Cleanup

Always clean up resources to avoid test pollution:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  try {
    managerService.removeManager(testDevice, testUser)
  } catch {
    // Ignore if doesn't exist
  }
})

afterEach(() => {
  fixture.cleanup()
  manager.scheduler.stop()
  vi.clearAllMocks()
  vi.clearAllTimers()
})
```

#### 6. Testing Task Lifecycle

Tasks transition through stages (PENDING → RUNNING → DONE):

```ts
const task = new Task('HeartBeat', createdAt)

// Wait for stage transition
await task.waitFor('RUNNING', { seconds: 5 })
await task.waitFor('DONE', { seconds: 10 })

// Test timeout handling
await expect(task.waitFor('RUNNING', { milliseconds: 50 })).rejects.toThrow(Task.TimeoutError)
```

### Running Tests

- `pnpm test` - runs all tests once (75 tests)
- `pnpm test:watch` - watch mode with interactive UI
- `pnpm typecheck` - type-check all packages
- `pnpm lint` - run ESLint
- `pnpm ci` - full CI pipeline (build + lint + typecheck + test)

Tests use Vitest with Node.js test environment and strict TypeScript mode.

## Client Architecture

The React dashboard (`client/src/Dashboard.tsx`) uses:

- **TanStack Query** for server state management with tRPC integration
- **tRPC with SSE subscriptions** for real-time updates (no polling required)
- **shadcn/ui components** for polished, accessible UI primitives
- **@schedule-x/calendar** for interactive schedule visualization
- **TailwindCSS 4** for styling with CSS variables and dark mode
- **React 19** with React Compiler enabled for automatic optimizations
- **Temporal API** for timezone-aware date/time handling
- **Sonner** for toast notifications

### Key Components

#### Dashboard Layout (Grid-based Responsive)

```tsx
<main className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
  {/* Screenshot - Large, aspect-video */}
  <ScreenshotViewer className="md:col-span-6 lg:col-span-8 lg:row-span-2" />

  {/* Quick Actions + Lock Toggle - Horizontal layout */}
  <div className="md:col-span-4 lg:col-span-6">
    <QuickActions />
    <LockToggle />
  </div>

  {/* Task Manager - List with accordion */}
  <TaskManager className="col-span-full lg:col-span-6" />

  {/* Log Viewer - Scrollable accordion */}
  <LogViewer className="col-span-full lg:col-span-6" />

  {/* Schedule Manager - Full-width calendar */}
  <ScheduleManager className="col-span-full lg:col-span-6" />

  {/* Task Statistics - Compact metrics */}
  <TaskStatistics className="md:col-span-4 lg:col-span-6" />

  {/* Config Viewer - Copy-to-clipboard URLs */}
  <ConfigViewer className="col-span-full lg:col-span-6" />
</main>
```

#### Connection State Management

The dashboard tracks three connection states:

1. **Server Connection**: `heartbeat.data === true` (tRPC heartbeat query)
2. **Loading State**: `heartbeat.isPending` (initial connection attempt)
3. **Error State**: `heartbeat.isError` (connection failed)

Use these states to:

- Disable features when disconnected (`connected={connected}` prop)
- Show loading overlays during initial connection
- Display error messages and retry options

#### Real-time Updates via SSE Subscriptions

```tsx
// Task state subscription
const { data: { tasks = [] } = {} } = useSubscription({
  ...trpc.state.subscriptionOptions(),
  enabled: connected, // Only subscribe when connected
})

// Device logs subscription
const { data: logs = [] } = useSubscription(trpc.deviceLog.subscriptionOptions())
```

SSE subscriptions use `httpSubscriptionLink` and automatically:

- Reconnect on disconnect
- Handle keepalive pings every 2 seconds
- Batch events when multiple occur rapidly

#### shadcn/ui Component Usage

All UI components are from shadcn/ui (Radix UI + Tailwind):

- **Forms**: `<Form>`, `<Input>`, `<Select>`, `<Switch>`, `<Label>`, `<Field>`
- **Layout**: `<Card>`, `<Separator>`, `<ScrollArea>`, `<Tabs>`
- **Overlays**: `<Dialog>`, `<Popover>`, `<DropdownMenu>`
- **Feedback**: `<Alert>`, `<Badge>`, `<Skeleton>`, `<Spinner>`, `Toaster` (Sonner)
- **Interactive**: `<Button>`, `<Accordion>`, `<Toggle>`, `<Collapsible>`

Components are configured in `client/components.json` with:

- Style: `new-york` (modern, clean aesthetic)
- Icon library: `lucide-react`
- CSS variables: enabled for theming
- Aliases: `@/components/ui`, `@/lib/utils`, `@/hooks`

#### @schedule-x Calendar Integration

The ScheduleManager component uses @schedule-x for visual scheduling:

```tsx
const calendar = useCalendarApp({
  views: [createViewDay(), createViewWeek(), createViewList()],
  theme: 'shadcn', // Custom theme matching UI
  isDark: resolvedTheme === 'dark', // Sync with app theme
  timezone: browserTz, // User's browser timezone
  events: [...schedules, ...officialEvents, newDaySeparator],
  callbacks: {
    onEventClick: ({ id }) => setScheduleIdEdit(id),
    onClickDateTime: (dt) => setDateTimeToAdd(dt),
  },
})
```

Calendar features:

- **Daily/Weekly/List Views**: Switch between visualization modes
- **Color-coded Events**: Different calendars for tasks, official events, separators
- **Click Handlers**: Edit schedules on click, add on datetime click
- **Recurring Events**: RRULE support for daily schedules
- **Timezone-aware**: All datetimes use `Temporal.ZonedDateTime`

#### Utility Functions

```tsx
// Format duration (auto-selects unit: day/hour/minute/second)
formatDuration(task.duration) // "5s", "2m", "1.5h"

// Format timestamp (locale-aware)
formatTime(task.createdAt) // "10/26/25, 3:15 PM"

// Format task type (Chinese display names)
formatTaskType('LinkStart') // "启动链接"
formatTaskType('LinkStart-Combat') // "启动链接-战斗"

// Tailwind class merging
cn('px-4', 'px-2') // "px-2" (latter wins)
cn('px-4', className) // Safely merge with prop className
```
