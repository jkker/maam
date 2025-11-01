# MAA Manager

> A modern web server and dashboard implementing the [MAA (MaaFramework) remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html)

MAA Manager provides a web-based control interface for MAA automation clients, enabling task scheduling, real-time monitoring, and device management through a clean, responsive dashboard.

## ✨ Features

### Core Features

- 🎯 **MAA Protocol Support**: Full implementation of MAA remote control protocol endpoints
- 🔄 **Real-time Updates**: Server-Sent Events (SSE) subscriptions for live task status and device screenshots
- ⏰ **Visual Scheduling**: Interactive calendar powered by [@schedule-x](https://schedule-x.dev/) with daily/weekly/list views
- 📊 **Task Management**: Monitor task lifecycle (pending → running → done) with detailed execution metrics
- 🔒 **Access Control**: Device and user authorization for secure remote control
- 🎨 **Modern UI**: Polished components from [shadcn/ui](https://ui.shadcn.com/) with dark mode support
- 📱 **Mobile-first Design**: Fully responsive interface optimized for all screen sizes
- 🔧 **Type-safe APIs**: End-to-end type safety using tRPC with React Query integration

### Advanced Task Management

- 🔍 **Real-time Monitoring**: Live task updates via SSE subscriptions, no polling required
- 🔎 **Task Search**: Filter tasks by type or ID with instant results
- 📈 **Task Statistics**: Success rate, failure count, average duration, and execution trends
- ⏱️ **Execution Tracking**: Automatic timestamps for task creation, start, and completion
- � **Expandable Details**: Accordion-style task list with full metadata on demand
- ⚡ **Quick Dispatch**: Create any task type instantly via dropdown menu
- 🎯 **Immediate vs Queued**: Automatic handling of synchronous (HeartBeat, StopTask) vs asynchronous tasks

### Enhanced Schedule Features

- 📅 **Interactive Calendar**: Daily/weekly/list views with drag-and-drop support (upcoming)
- 🕐 **Execution History**: Last run time and total run count for each schedule
- 🌍 **Timezone Support**: Configure schedules in any IANA timezone
- � **Event Integration**: View official Arknights events alongside your schedules
- 🎨 **Color-coded Events**: Visual distinction between tasks, official events, and daily separators
- ⏰ **Flexible Timing**: Minute-level precision with cron-based recurrence

### Intelligent Task-Log Assignment

- 🧩 **Optimal Matching**: Hungarian Algorithm (Munkres) for assigning tasks to execution logs
- ⏱️ **Multi-criteria Cost Function**: Time proximity and duration similarity
- 🌐 **Timezone-aware**: Handles UTC tasks vs Asia/Shanghai logs automatically
- ⚖️ **Unbalanced Support**: Correctly handles cases where tasks ≠ logs
- 🎛️ **Configurable**: Adjustable weights for time vs duration matching
- 📊 **O(n³) Complexity**: Efficient assignment even with hundreds of tasks/logs

See [Assignment Solver Documentation](server/src/lib/ASSIGNMENT.md) for detailed usage and examples.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** 10+ (required for monorepo workspaces)
- **MAA Desktop Client** configured to use remote control mode

### Installation

```bash
# Clone the repository
git clone https://github.com/Jkker/maam.git
cd maam

# Install dependencies
pnpm install

# Start development servers (both server + client with HMR)
pnpm dev

# Server runs on http://localhost:3113
# Client dev server runs on http://localhost:5173 (proxies API to :3113)
```

### Production Build

```bash
# Build both server and client
pnpm build

# Start production server (serves client at root)
pnpm start

# Server listens on http://0.0.0.0:3113
```

### MAA Client Configuration

Configure your MAA desktop client with these remote control URLs (accessible from the dashboard's "MAA Configuration URLs" section):

- **Get Task**: `http://your-server:3113/maa/getTask`
- **Report Status**: `http://your-server:3113/maa/reportStatus`
- **Device Log Webhook**: `http://your-server:3113/maa/deviceLog`

Default credentials (see `server/src/index.ts` to customize):

- **Device ID**: `bdc57941058a47e6bf56f2a993c87af3`
- **User**: `user`

## 📦 Project Structure

This is a **pnpm monorepo** with two packages:

```
maam/
├── server/          # @maam/server - Hono HTTP server + tRPC API
│   └── src/
│       ├── index.ts         # Main app with tRPC router & HTTP routes
│       ├── server.ts        # Production server entry (@hono/node-server)
│       ├── MaaManager.ts    # Task orchestration & scheduling engine
│       └── lib/
│           ├── schema.ts    # Zod schemas & TypeScript types
│           ├── logger.ts    # Logging utilities (tslog)
│           ├── temporal.ts  # Temporal API utilities
│           └── prts.wiki.ts # Arknights event calendar scraper
│
├── client/          # @maam/client - React dashboard
│   └── src/
│       ├── main.tsx           # React entry point
│       ├── Dashboard.tsx      # Main dashboard component
│       ├── Layout.tsx         # Header & Footer components
│       ├── components/
│       │   ├── ScheduleManager.tsx  # @schedule-x calendar integration
│       │   ├── ui/            # shadcn/ui components (accordion, button, etc.)
│       │   └── ...
│       ├── hooks/
│       │   ├── useTheme.tsx   # Dark mode theme hook
│       │   └── ...
│       └── lib/
│           ├── trpc.ts        # tRPC client with SSE subscriptions
│           └── utils.ts       # Tailwind merge, date formatting
│
└── package.json     # Root workspace configuration
```

### Key Technologies

#### Server Stack

- **[Hono](https://hono.dev/)** - Fast, lightweight web framework with middleware support
- **[tRPC](https://trpc.io/)** - Type-safe API layer with SSE subscriptions for real-time updates
- **[Zod](https://zod.dev/)** - Schema validation and type inference
- **[toad-scheduler](https://github.com/kibertoad/toad-scheduler)** - Cron job scheduler for recurring tasks
- **[Temporal Polyfill](https://github.com/js-temporal/temporal-polyfill)** - Modern date/time API
- **[tslog](https://tslog.js.org/)** - Structured logging with rotation
- **TypeScript 5.9** - Strict type checking
- **Vite 7 (Rolldown)** - Fast build tool with native bundler

#### Client Stack

- **[React 19](https://react.dev/)** - UI framework with React Compiler enabled
- **[TanStack Query](https://tanstack.com/query)** - Server state management with optimistic updates
- **[tRPC + React Query](https://trpc.io/docs/client/react)** - Type-safe API client with hooks
- **[shadcn/ui](https://ui.shadcn.com/)** - High-quality, accessible Radix UI components
- **[@schedule-x](https://schedule-x.dev/)** - Modern calendar library with React integration
- **[TailwindCSS 4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Lucide React](https://lucide.dev/)** - Beautiful, consistent icon library
- **[Sonner](https://sonner.emilkowal.ski/)** - Toast notifications
- **Vite 7 (Rolldown)** - Dev server with HMR

## 🔌 API Reference

The server exposes both **tRPC procedures** (for the dashboard) and **HTTP endpoints** (for MAA protocol compliance).

### tRPC Procedures (Dashboard API)

All tRPC procedures use Server-Sent Events (SSE) for real-time subscriptions when applicable.

#### Manager Control

- **`start`** (mutation) - Dispatch `LinkStart` task
- **`stop`** (mutation) - Dispatch `StopTask` (immediate execution)
- **`heartbeat`** (query) - Health check, returns `true` if device responds
- **`isLocked`** (query) - Get current lock state
- **`toggleLock`** (mutation) - Lock/unlock manager (input: `boolean`)

#### Task Management

- **`dispatch`** (mutation) - Create any task type immediately
  - Input: `{ task: TaskType, params?: string }`
  - Output: `{ success: true, task: TaskData }`
- **`state`** (subscription) - Real-time task updates via SSE
  - Emits whenever task state changes (create/start/complete)
  - Output: `{ tasks: TaskData[] }`

#### Schedule Management

- **`schedules`** (query) - Get all schedules
- **`addSchedule`** (mutation) - Create new cron schedule
  - Input: `{ hour: 0-23, minute?: 0-59, task?: TaskType, timezone?: string }`
  - Output: `{ success: true, message: string, schedule: ScheduleData }`
- **`removeSchedule`** (mutation) - Delete schedule by ID
  - Input: `string` (schedule ID)
- **`schedule.get`** (query) - Alias for `schedules`
- **`schedule.add`** (mutation) - Alias for `addSchedule`
- **`schedule.remove`** (mutation) - Alias for `removeSchedule`

#### Screenshot & Logs

- **`screenshot`** (subscription) - Real-time screenshot updates via SSE
  - Emits base64-encoded PNG when screenshot task completes
- **`screenshotQuery`** (query) - Capture and return screenshot immediately
  - Output: `string` (base64-encoded PNG)
- **`deviceLog`** (subscription) - Real-time device logs via SSE
  - Emits log entries from MAA client
  - Output: `string[]` (log messages)

#### Event Calendar

- **`eventCalendar`** (query) - Fetch official Arknights events from PRTS Wiki
  - Output: `CalendarEvent[]`

### MAA Protocol Endpoints (HTTP)

These endpoints implement the [MAA remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html):

#### Task Control

- **`POST /maa/getTask`** - Poll for pending tasks (MAA client polling endpoint)
  - Auth: requires `device` and `user` in request body
  - Response: `{ tasks: [{ id, type, params? }] }`
  - Marks tasks as `RUNNING` and removes from queue
- **`POST /maa/reportStatus`** - Report task completion status
  - Body: `{ task: id, status: 'SUCCESS'|'FAILED', payload?: base64, device, user }`
  - Updates task stage to `DONE` and emits event to waiting handlers
- **`POST /maa/deviceLog`** - Receive device logs from MAA client
  - Body: plain text log data
  - Parses and broadcasts logs via SSE subscription

#### Quick Actions (HTTP Endpoints)

- **`GET /maa/screenshot`** - Capture and return device screenshot (PNG)
  - Creates `CaptureImageNow` task, waits for completion
  - Response: Binary PNG image

#### Manager Control (HTTP Endpoints)

- **`GET /maa/lock`** - Lock manager (pauses schedules, blocks new queued tasks)
  - Response: Text confirmation message
- **`GET /maa/unlock`** - Unlock manager (resumes schedules)
  - Response: Text confirmation message

### Dashboard UI

- **`GET /`** - Serves the React dashboard
  - Static files from `dist/public/` in production
  - Proxies to Vite dev server in development

## 📖 Task System

### Task Types

Tasks are classified into two execution modes:

#### Immediate Tasks (Synchronous)

Execute synchronously and block until completion:

- **`HeartBeat`** - Health check to verify device connection
- **`StopTask`** - Stop currently running task
- **`CaptureImageNow`** - Take screenshot immediately

#### Queued Tasks (Asynchronous)

Return after reaching `RUNNING` stage, MAA client executes asynchronously:

- **`LinkStart`** - Start main automation routine
- **`CaptureImage`** - Schedule screenshot for next task cycle
- **`LinkStart-Combat`** - Combat-only routine
- **`LinkStart-Recruiting`** - Recruitment-only routine
- **`LinkStart-Mall`** - Shop-only routine
- **`LinkStart-Mission`** - Mission-only routine
- **`LinkStart-AutoRoguelike`** - Roguelike mode
- **`LinkStart-Reclamation`** - Reclamation Algorithm mode
- **`LinkStart-Base`** - Base management only
- **`LinkStart-WakeUp`** - Wake-up routine

### Task Lifecycle

```
PENDING → RUNNING → DONE
   ↓         ↓         ↓
Created   Polled   Reported
```

1. **PENDING**: Task created via tRPC `dispatch` or schedule trigger
   - Assigned unique ID: `TaskType|ISO8601timestamp`
   - `createdAt` timestamp recorded
   - Enqueued for MAA client polling

2. **RUNNING**: MAA client polls `/maa/getTask`, task dequeued
   - `startedAt` timestamp recorded
   - Task removed from queue
   - MAA client begins execution

3. **DONE**: MAA client reports via `/maa/reportStatus`
   - `completedAt` timestamp recorded
   - `duration` automatically calculated (in milliseconds)
   - `status` set to `SUCCESS` or `FAILED`
   - Optional `payload` (e.g., base64-encoded screenshot)
   - SSE broadcast triggers dashboard update

### Task Data Structure

Each task contains comprehensive execution metadata:

```typescript
{
  id: string                  // "TaskType|2025-10-26T03:15:00Z"
  type: TaskType              // "LinkStart", "HeartBeat", etc.
  stage: 'PENDING' | 'RUNNING' | 'DONE'
  status?: 'SUCCESS' | 'FAILED'
  params?: string             // Optional task parameters
  payload?: string            // Task result (e.g., base64 PNG for screenshots)
  createdAt: string           // ISO 8601 timestamp
  startedAt?: string          // ISO 8601 timestamp
  completedAt?: string        // ISO 8601 timestamp
  duration?: number           // Execution time in milliseconds
}
```

## ⏰ Scheduling

Schedules use cron-based recurrence powered by `toad-scheduler`:

### Creating Schedules

```typescript
// Via tRPC (from dashboard or API)
await trpc.addSchedule.mutate({
  task: 'LinkStart',
  hour: 3,
  minute: 15,
  timezone: 'Asia/Shanghai', // Optional, defaults to browser timezone
})

// Returns schedule ID like "LinkStart|3:15"
```

### Schedule Features

- **Cron Expression**: `0 minute hour * * *` (daily recurrence)
- **Execution Tracking**: `lastRunTime` and `runCount` automatically updated
- **Timezone Support**: Any IANA timezone (e.g., `America/New_York`, `Europe/London`)
- **Lock Behavior**: Schedules pause when manager is locked, resume on unlock
- **Unique IDs**: Deterministic format `{task}|{hour}:{minute}`

### Schedule Data Structure

```typescript
{
  id: string              // "LinkStart|3:15"
  type: TaskType          // "LinkStart"
  hour: number            // 0-23
  minute: number          // 0-59
  timezone?: string       // IANA timezone
  lastRunTime?: string    // ISO 8601 timestamp of last execution
  runCount: number        // Total executions since creation
  nextRunTime?: string    // ISO 8601 timestamp of next scheduled run
}
```

## 🛠️ Development

### Available Commands

From repository root:

```bash
pnpm dev         # Start dev servers (server + client in parallel)
pnpm build       # Build all packages
pnpm start       # Run production server
pnpm test        # Run test suites
pnpm test:watch  # Run tests in watch mode
pnpm lint        # Lint code with ESLint
pnpm lint:fix    # Lint and auto-fix issues
pnpm format      # Check formatting with Prettier
pnpm format:fix  # Format all files with Prettier
pnpm typecheck   # Type-check all packages
pnpm ci          # Run full CI pipeline (build + lint + typecheck + test)
```

Package-specific commands (run from `server/` or `client/`):

```bash
pnpm dev         # Start package dev server
pnpm build       # Build package only
pnpm typecheck   # Type-check package only
```

### Testing

Tests use **Vitest** with comprehensive coverage:

- `server/src/index.test.ts` - tRPC procedure and HTTP endpoint integration tests
- `server/src/MaaManager.test.ts` - Task and MaaManager class unit tests

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode with interactive UI
```

### Code Quality

The project uses automated checks via `simple-git-hooks` and `lint-staged`:

- **Type checking**: `tsc --noEmit` (strict mode, no emit)
- **Linting**: ESLint with TypeScript, React, and import plugins
  - `@eslint-react/eslint-plugin` - React best practices
  - `eslint-plugin-import-x` - Import/export validation
  - `eslint-plugin-unused-imports` - Detect unused imports
- **Formatting**: Prettier with consistent config

Pre-commit hooks run automatically on staged files. Ensure code passes all checks before committing.

### Adding shadcn/ui Components

The project uses shadcn/ui components configured in `client/components.json`:

```bash
# From client/ directory
pnpm dlx shadcn@latest add <component-name>

# Example: Add a new dialog component
pnpm dlx shadcn@latest add dialog
```

Components are installed to `client/src/components/ui/` with full TypeScript support and Tailwind styling.

## 🔐 Authorization

MAA clients must provide valid `device` and `user` credentials with each request to protected endpoints (`/maa/getTask`, `/maa/reportStatus`, `/maa/deviceLog`).

Default manager configuration (see `server/src/index.ts` to customize):

```typescript
const manager = new MaaManager('bdc57941058a47e6bf56f2a993c87af3', 'user')
```

To add support for multiple devices, create additional `MaaManager` instances and add them to the `managers` map.

## 📱 Dashboard Features

The React dashboard provides a comprehensive management interface:

- **Live Screenshot Viewer**: Real-time device screen via SSE subscription, auto-refreshing
- **Quick Actions**: One-click Start, Stop, and custom task dispatch via dropdown
- **Task Manager**: Searchable, filterable task list with accordion details
- **Schedule Calendar**: Interactive daily/weekly/list views powered by @schedule-x
- **Task Statistics**: Success rate, failure count, average duration metrics
- **Device Logs**: Real-time log viewer with collapsible entries
- **Lock Control**: Toggle manager lock state to pause/resume schedules
- **MAA Configuration URLs**: Copy-to-clipboard endpoints for MAA client setup
- **Dark Mode**: System-aware theme with manual toggle
- **Responsive Layout**: Mobile-first design that scales to desktop

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and ensure tests pass (`pnpm test`)
4. Verify type safety (`pnpm typecheck`)
5. Format code (`pnpm format:fix`)
6. Commit with clear messages (pre-commit hooks will run automatically)
7. Push to your branch
8. Open a Pull Request

Please follow the existing code style and ensure all CI checks pass before submitting.

## 📝 License

This project is open source. Check the repository for license details.

## 🔗 Related Links

- [MAA Framework Documentation](https://docs.maa.plus/)
- [MAA Remote Control Protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html)
- [Hono Documentation](https://hono.dev/)
- [tRPC Documentation](https://trpc.io/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [@schedule-x Documentation](https://schedule-x.dev/)
- [TanStack Query Documentation](https://tanstack.com/query)

## 🔗 Related Links

- [MAA Framework Documentation](https://docs.maa.plus/)
- [MAA Remote Control Protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html)
- [Hono Documentation](https://hono.dev/)
- [React Documentation](https://react.dev/)
