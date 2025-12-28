# AGENTS.md - AI Coding Agent Instructions

## Project Overview

A **pnpm monorepo** for the MAA (MaaFramework) remote control protocol:

- **@maam/server** (`server/src/`): Hono HTTP server with oRPC API, SQLite (Drizzle ORM), task scheduling
- **@maam/client** (`client/src/`): React 19 dashboard with shadcn/ui, TanStack Query, Tailwind CSS 4

## Commands

### Build / Lint / Test (from root)

```bash
pnpm install              # Install dependencies (required: pnpm)
pnpm dev                  # Start dev servers (server:3113, client:vite)
pnpm build                # Build all packages
pnpm lint                 # ESLint check
pnpm lint:fix             # ESLint with auto-fix
pnpm format               # Prettier check
pnpm format:fix           # Prettier write
pnpm typecheck            # TypeScript check (uses tsgo)
pnpm test                 # Run all tests
pnpm ci                   # Full CI: build + lint + typecheck + test
```

### Running Single Tests

```bash
# From root - run specific test file
pnpm -F @maam/server vitest run src/test/manager.test.ts

# Run with pattern matching
pnpm -F @maam/server vitest run -t "should create and complete a task"

# Watch mode for single file
pnpm -F @maam/server vitest src/test/manager.test.ts
```

### Package-Specific Commands

```bash
# Server
cd server && pnpm dev     # Vite dev server with HMR (port 3113)
cd server && pnpm build   # Build to dist/
cd server && pnpm drizzle # Drizzle-kit CLI

# Client
cd client && pnpm dev     # Vite dev server (proxies to localhost:3113)
cd client && pnpm build   # Build to ../server/dist/public/
```

## Code Style Guidelines

### Formatting (Prettier)

- 2-space indentation, no tabs, no semicolons
- Single quotes, trailing commas (all), 100 char print width

### TypeScript

- **Strict mode** enabled - never use `any`, prefer `unknown` with type guards
- Use `verbatimModuleSyntax` - always use `import type` for type-only imports
- Use `Temporal` API for dates/times (via `temporal-polyfill`)

### Import Order (ESLint enforced)

```typescript
// 1. Type imports (always separate with `import type`)
import type { TaskData } from '@maam/server'

// 2. Node built-ins
import { EventEmitter } from 'node:events'

// 3. External packages (alphabetized)
import { Hono } from 'hono'

// 4. Internal aliases (@/, @maam/*)
import { cn } from '@/lib/utils'

// 5. Relative imports (parent, then sibling)
import { Task } from '../Task'
```

### Naming Conventions

| Element          | Convention       | Example                       |
| ---------------- | ---------------- | ----------------------------- |
| Files            | kebab-case       | `task-status-badge.tsx`       |
| Components       | PascalCase       | `ScheduleManager`             |
| Functions/vars   | camelCase        | `formatDuration`, `isLocked`  |
| Constants        | UPPER_SNAKE_CASE | `TASK_TYPE`, `IMMEDIATE_TASK` |
| Types/Interfaces | PascalCase       | `TaskData`, `ScheduleData`    |
| Schemas          | camelCase+Schema | `scheduleSchema`              |

### React Patterns (Client)

- React 19 with React Compiler, TanStack Query + oRPC for data fetching
- shadcn/ui components from `@/components/ui/*`, icons from `lucide-react`
- `cn()` utility for class merging, `toast` from `sonner` for notifications
- Zustand for auth state, TanStack Query for server state

### Server Patterns

- **Hono** for HTTP routing, **oRPC** for type-safe RPC with SSE
- **ArkType** for runtime validation (NOT Zod)
- **Drizzle ORM** with SQLite, **EventEmitter** for typed pub/sub

```typescript
// ArkType schema
export const scheduleSchema = type({
  hour: '0 <= number.integer <= 23',
  minute: type('0 <= number.integer <= 59').default(0),
})
```

### Error Handling

- Custom error classes extending `Error` (e.g., `Task.TimeoutError`)
- oRPC errors: `throw new ORPCError('UNAUTHORIZED', { message: '...' })`
- Always log errors with `logger.error()` before throwing

### Testing (Vitest)

- Test files in `server/src/test/*.test.ts`
- Mock database service with `vi.mock()` to avoid I/O
- Use fixture classes for simulating MAA device behavior

```typescript
vi.mock('../lib/db/service', () => ({
  saveTask: vi.fn().mockResolvedValue(undefined),
}))

const { manager, fixture } = createTestManager('test-device', 'test-user')
fixture.startPolling()
await fixture.waitForTask(taskId, 2000)
fixture.stopPolling()
```

## Architecture Notes

### Task Lifecycle

1. **PENDING** → Task created, added to queue
2. **RUNNING** → MAA client polled via `/maa/getTask`
3. **DONE** → Status reported via `/maa/reportStatus`

### Immediate vs Queued Tasks

- **Immediate** (`HeartBeat`, `StopTask`, `CaptureImageNow`): Block until DONE
- **Queued** (`LinkStart`, etc.): Return after RUNNING, execute async

### Type Safety

- Server exports `ORPC` type from `server/src/index.ts`
- Client uses `createORPCClient<ORPC>` for full type inference
- Schemas in `@maam/server/schema` importable by client

## Pre-commit Hooks

Configured via `simple-git-hooks` + `lint-staged`:

1. `tsgo -b --noEmit` - TypeScript check
2. `eslint --fix` - Lint with auto-fix
3. `prettier --write` - Format

## File Structure

```
server/src/
├── index.ts          # Main router, oRPC procedures, Hono app
├── MaaManager.ts     # Core orchestration class
├── Task.ts           # Task class with lifecycle
├── TaskSchedule.ts   # Cron scheduling wrapper
├── const.ts          # Constants (TASK_TYPE, etc.)
├── lib/
│   ├── schema.ts     # ArkType schemas (single source of truth)
│   ├── db/           # Drizzle ORM (schema.ts, service.ts)
│   └── temporal.ts   # Temporal API utilities
└── test/             # Vitest test files

client/src/
├── main.tsx          # React entry point
├── Dashboard.tsx     # Main dashboard component
├── components/ui/    # shadcn/ui components
├── lib/orpc.ts       # oRPC client setup
└── lib/auth-store.ts # Zustand auth state
```
