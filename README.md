# MAA Manager

> A modern web server and dashboard implementing the [MAA (MaaFramework) remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html)

MAA Manager provides a web-based control interface for MAA automation clients, enabling task scheduling, real-time monitoring, and device management through a clean, responsive dashboard.

## ✨ Features

### Core Features

- 🎯 **MAA Protocol Support**: Full implementation of MAA remote control protocol endpoints
- 🔄 **Real-time Dashboard**: Auto-refreshing UI with live task status and device screenshots
- ⏰ **Cron Scheduling**: Schedule recurring tasks with flexible timezone support
- 📊 **Task Management**: Monitor task lifecycle (pending → running → done) with detailed status
- 🔒 **Access Control**: Device and user authorization for secure remote control
- 🎨 **Modern Stack**: React 19, Hono, TailwindCSS 4, TypeScript, and Vite
- 📱 **Mobile-first Design**: Fully responsive interface that works on all devices
- 🔧 **Type-safe APIs**: End-to-end type safety using Hono's RPC client

### Advanced Task Management (NEW)

- 🔍 **Task Filtering**: Filter tasks by status (All, Success, Failed, Running, Pending)
- 🔎 **Task Search**: Search tasks by type or ID in real-time
- 📈 **Task Statistics**: View success rate, failure count, and average execution duration
- ⏱️ **Execution Tracking**: Automatic tracking of task creation, start, and completion times
- 📤 **Export History**: Export task history as JSON or CSV for analysis
- 🗑️ **History Management**: Clear completed tasks to keep dashboard clean
- 📋 **Expandable Details**: Click tasks to view full metadata including timestamps and parameters
- ⚡ **Immediate Dispatch**: Create any task type on-demand via API or UI dialog

### Enhanced Schedule Features (NEW)

- 🕐 **Last Run Time**: See when each schedule last executed (relative time)
- 📊 **Run Count**: Track how many times each schedule has run
- 📅 **Schedule Metadata**: Complete visibility into schedule execution history

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10+ (required for monorepo workspaces)

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers (server + client with HMR)
pnpm dev

# Server runs on http://localhost:3113
# Client dev server runs on http://localhost:5173 (proxies to server)
```

### Production Build

```bash
# Build both server and client
pnpm build

# Start production server
pnpm start

# Server serves client at http://0.0.0.0:3113
```

## 📦 Project Structure

This is a **pnpm monorepo** with two packages:

```
maam/
├── server/          # @maam/server - Hono HTTP server
│   └── src/
│       ├── index.ts       # Main app with API routes
│       ├── server.ts      # Production server entry
│       ├── MaaManager.ts  # Task orchestration & scheduling
│       └── lib/
│           ├── schema.ts  # Zod schemas & types
│           └── logger.ts  # Logging utilities
│
├── client/          # @maam/client - React dashboard
│   └── src/
│       ├── main.tsx       # React entry point
│       ├── App.tsx        # Main dashboard component
│       └── Layout.tsx     # UI layout components
│
└── package.json     # Root workspace configuration
```

## 🔌 API Reference

### MAA Protocol Endpoints

These endpoints implement the [MAA remote control protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html):

#### Task Control

- **`POST /maa/getTask`** - Poll for pending tasks (MAA client polling endpoint)
  - Auth: requires `device` and `user` in request body
  - Response: `{ tasks: [{ id, type, params? }] }`
- **`POST /maa/reportStatus`** - Report task completion status
  - Body: `{ task: id, status: 'SUCCESS'|'FAILED', payload?: base64, device, user }`
  - Updates task stage and resolves waiting handlers

#### Task Dispatch (Convenience Endpoints)

- **`GET /maa/health`** - Dispatch HeartBeat task (immediate execution)
- **`GET /maa/start`** - Dispatch LinkStart task (queued)
- **`GET /maa/stop`** - Dispatch StopTask task (immediate)
- **`GET /maa/screenshot`** - Capture and return device screenshot (PNG)
- **`POST /maa/dispatch`** - Dispatch any task type immediately (NEW)
  - Body: `{ task: TaskType, params?: string }`
  - Response: `{ success: true, task: TaskData }`
  - Respects manager lock status

#### Manager Control

- **`GET /maa/state`** - Get current manager state
  - Response: `{ locked: boolean, tasks: Task[], schedules: Schedule[] }`
- **`GET /maa/lock`** - Lock manager (pauses schedules, blocks new queued tasks)
- **`GET /maa/unlock`** - Unlock manager (resumes schedules)

#### Schedule Management

- **`POST /maa/schedule`** - Create a new cron schedule
  - Body: `{ hour: 0-23, minute?: 0-59, task?: TaskType, timezone?: string }`
  - Returns: `{ success: true, id: string }`
- **`DELETE /maa/schedule/:id`** - Remove a schedule by ID

#### Task History Management (NEW)

- **`GET /maa/tasks/export?format=json|csv`** - Export task history
  - Query params: `format` - either `json` or `csv`
  - Response: File download with task history
- **`DELETE /maa/tasks/completed`** - Clear all completed tasks
  - Response: `{ success: true, count: number }`

### Dashboard UI

- **`GET /`** - Serves the React dashboard (static files from `dist/public/`)

## 🛠️ Development

### Available Commands

From repository root:

```bash
pnpm dev         # Start dev servers (parallel)
pnpm build       # Build all packages
pnpm start       # Run production server
pnpm test        # Run test suites
pnpm lint        # Lint code
pnpm format      # Format with Prettier
pnpm typecheck   # Type-check all packages
```

Package-specific commands (run from `server/` or `client/`):

```bash
pnpm dev         # Start package dev server
pnpm build       # Build package only
```

### Technology Stack

#### Server (`@maam/server`)

- **[Hono](https://hono.dev/)** - Fast, lightweight web framework
- **[Zod](https://zod.dev/)** - Schema validation
- **[toad-scheduler](https://github.com/kibertoad/toad-scheduler)** - Cron job scheduler
- **[Temporal Polyfill](https://github.com/js-temporal/temporal-polyfill)** - Date/time handling
- **[tslog](https://tslog.js.org/)** - Logging
- **TypeScript 5.9** - Type safety
- **Vite 7 (Rolldown)** - Build tool

#### Client (`@maam/client`)

- **[React 19](https://react.dev/)** with React Compiler - UI framework
- **[TanStack Query](https://tanstack.com/query)** - Server state management
- **[TailwindCSS 4](https://tailwindcss.com/)** - Styling
- **Hono RPC Client** - Type-safe API calls
- **Vite 7 (Rolldown)** - Build tool & dev server

### Testing

Tests use **Vitest** with comprehensive coverage:

- `server/src/index.test.ts` - API route integration tests
- `server/src/MaaManager.test.ts` - Task and manager unit tests

```bash
pnpm test        # Run once
pnpm test:watch  # Watch mode
```

### Code Quality

The project uses automated checks via `simple-git-hooks` and `lint-staged`:

- **Type checking**: `tsc --noEmit`
- **Linting**: ESLint with TypeScript, React, and import plugins
- **Formatting**: Prettier

Pre-commit hooks run automatically. Ensure code passes all checks before committing.

## 📖 Task System

### Task Types

Tasks fall into two categories:

1. **Immediate Tasks** (synchronous execution):
   - `HeartBeat` - Health check
   - `StopTask` - Stop current task
   - `CaptureImageNow` - Take screenshot

2. **Queued Tasks** (asynchronous execution):
   - `LinkStart` - Start main task
   - `CaptureImage` - Schedule screenshot
   - Various `LinkStart-*` subtasks (Combat, Recruiting, Mall, etc.)

### Task Lifecycle

```
PENDING → RUNNING → DONE
   ↓         ↓         ↓
Created   Polled   Reported
```

1. **PENDING**: Task created via `manager.create(type, params?)`
   - `createdAt` timestamp recorded
2. **RUNNING**: MAA client polls via `/maa/getTask`, task dequeued
   - `startedAt` timestamp recorded
3. **DONE**: MAA client reports completion via `/maa/reportStatus`
   - `completedAt` timestamp recorded
   - `duration` (ms) automatically calculated

### Task Data Structure

Each task includes comprehensive execution metadata:

```typescript
{
  id: string                // Unique ID: "TaskType|ISO8601timestamp"
  type: TaskType            // Task type (LinkStart, HeartBeat, etc.)
  stage: 'PENDING' | 'RUNNING' | 'DONE'
  status?: 'SUCCESS' | 'FAILED'
  params?: string           // Optional task parameters
  payload?: string          // Task result payload (base64)
  createdAt: string         // ISO 8601 timestamp
  startedAt?: string        // ISO 8601 timestamp
  completedAt?: string      // ISO 8601 timestamp
  duration?: number         // Execution time in milliseconds
}
```

## 🔐 Authorization

MAA clients must provide valid `device` and `user` credentials with each request. The server validates these against configured manager instances.

Default manager (see `server/src/index.ts`):

```ts
const manager = new MaaManager('bdc57941058a47e6bf56f2a993c87af3', 'user')
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and ensure tests pass (`pnpm test`)
4. Commit with clear messages
5. Push to your branch
6. Open a Pull Request

## 📝 License

This project is open source. Check the repository for license details.

## 🔗 Related Links

- [MAA Framework Documentation](https://docs.maa.plus/)
- [MAA Remote Control Protocol](https://docs.maa.plus/zh-cn/protocol/remote-control-schema.html)
- [Hono Documentation](https://hono.dev/)
- [React Documentation](https://react.dev/)
