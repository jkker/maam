## Project Overview

This is a **monorepo** implementing a web server and dashboard for the [MAA (MaaFramework) remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html). The project consists of two packages:

- **@maam/server**: Hono-based HTTP server implementing MAA protocol endpoints (`server/src/`)
- **@maam/client**: React dashboard for managing tasks and schedules (`client/src/`)

The server acts as a remote control endpoint for MAA client applications, managing task dispatch, scheduling, and authorization.

## Architecture & Key Files

### Server Package (`server/src/`)

- **`index.ts`**: Main application entry point. Defines all HTTP routes (`/maa/*` API endpoints) and exports the `app` instance and default `manager`
- **`server.ts`**: Production server entry using `@hono/node-server`, listens on `0.0.0.0:3113`
- **`MaaManager.ts`**: Core orchestration class managing tasks, queues, scheduling, and device authorization
- **`lib/schema.ts`**: Zod schemas and TypeScript types for MAA protocol (task types, stages, validation)
- **`lib/logger.ts`**: Logging utilities using tslog

### Client Package (`client/src/`)

- **`main.tsx`**: React app entry point
- **`App.tsx`**: Main dashboard component using TanStack Query for server state management
- **`Layout.tsx`**: Header and footer components for the UI
- Builds to `server/dist/public/` and served as static assets via `serveStatic` middleware

## Task System

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

## Development & Tooling

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

- `server/src/index.test.ts` - integration tests for HTTP API routes
- `server/src/MaaManager.test.ts` - unit tests for Task and MaaManager classes

### Testing Patterns

1. **Use the exported `app` and `manager`** from `server/src/index.ts` for integration tests
2. **Use Hono's RPC client for testing routes**:
   ```ts
   const client = hc<RouteType>('/', { fetch: app.request })
   const res = await client.maa.health.$get({ json: { device, user } })
   ```
3. **Freeze time for deterministic task IDs**:
   ```ts
   vi.spyOn(Temporal.Now, 'instant').mockReturnValue(frozenInstant)
   ```
4. **Mock scheduler** to avoid real timers:
   ```ts
   const schedulerStub = {
     addCronJob: vi.fn(),
     removeById: vi.fn(),
     stop: vi.fn(),
     getAllJobs: vi.fn().mockReturnValue([]),
   } as unknown as ToadScheduler
   manager.scheduler = schedulerStub
   ```
5. **Clean up manager state** in `beforeEach`/`afterEach` hooks when testing shared `manager` instance

### Running Tests

- `pnpm test` - runs all tests once
- `pnpm test:watch` - watch mode
- Tests use Vitest with Node.js test environment

## Client Architecture

The React dashboard (`client/src/App.tsx`) uses:

- **TanStack Query** for server state management (polling every 5s)
- **Hono RPC client** for type-safe API calls: `hc<RouteType>(apiBase)`
- **TailwindCSS 4** for styling
- **React 19** with React Compiler enabled

Key features:

- Real-time task/schedule list updates
- Live screenshot viewer (refreshes every 5s)
- Quick actions: Start, Stop, Lock, Unlock
- Schedule management: Add/remove cron schedules
- System status indicator (Online/Offline)

API base URL is `http://localhost:3113` in dev mode, `window.location.origin` in production.

## Type Safety

- Server exports `RouteType` for client-side RPC type inference
- Client imports type from `@maam/server` (workspace dependency)
- Schemas in `@maam/server/schema` can be imported by external consumers
- Use `hc<RouteType>(url)` in any TypeScript consumer for full type safety
