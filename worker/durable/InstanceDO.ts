import { DurableObject } from 'cloudflare:workers'

import { type Command, type DomainEvent, reconcile } from '../../shared/domain/reconcile'
import { createInitialState, type InstanceState } from '../../shared/domain/state'
import type { Env } from '../env'

/**
 * Durable Object representing a single MAA automation instance.
 * Key: `${user}:${device}`
 *
 * Responsibilities:
 * - Scheduler policy enforcement
 * - Lock lease management
 * - Cooldown tracking
 * - Task dispatch/tracking
 * - Run history
 * - Log ingestion
 * - Audit trail
 */
export class InstanceDO extends DurableObject<Env> {
  private state: InstanceState | null = null
  private sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql

    void ctx.blockConcurrencyWhile(async () => {
      this.initSchema()
      this.state = this.loadState()
    })
  }

  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        maa_task_id TEXT,
        generation INTEGER,
        state TEXT,
        created_at TEXT,
        dispatched_at TEXT,
        finished_at TEXT,
        status TEXT,
        payload TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS config_revisions (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        actor TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `)
  }

  private loadState(): InstanceState {
    const row = this.sql
      .exec<{ value: string }>("SELECT value FROM state WHERE key = 'current'")
      .toArray()[0]
    if (row) {
      return JSON.parse(row.value) as InstanceState
    }
    return createInitialState(this.ctx.id.toString())
  }

  private saveState(): void {
    if (!this.state) return
    this.sql.exec(
      "INSERT OR REPLACE INTO state (key, value) VALUES ('current', ?)",
      JSON.stringify(this.state),
    )
  }

  private syncInstanceId(request: Request): void {
    const instanceId = request.headers.get('X-Instance-Id')
    if (!instanceId || !this.state) {
      return
    }

    if (this.state.instanceId === instanceId) {
      return
    }

    if (!this.state.instanceId.includes(':') && instanceId.includes(':')) {
      this.state = {
        ...this.state,
        instanceId,
      }
      this.saveState()
    }
  }

  private emitEvents(events: DomainEvent[]): void {
    const now = new Date().toISOString()
    for (const event of events) {
      this.sql.exec(
        'INSERT INTO events (at, type, data) VALUES (?, ?, ?)',
        now,
        event.type,
        JSON.stringify(event),
      )

      // Update runs table based on event type
      this.updateRunsFromEvent(event, now)
    }
  }

  private updateRunsFromEvent(event: DomainEvent, now: string): void {
    switch (event.type) {
      case 'RunScheduled':
        this.sql.exec(
          `INSERT INTO runs (run_id, maa_task_id, generation, state, created_at)
           VALUES (?, '', 0, 'PENDING_DISPATCH', ?)`,
          event.runId,
          now,
        )
        break

      case 'TaskDispatched':
        this.sql.exec(
          `UPDATE runs SET maa_task_id = ?, state = 'DISPATCHED', dispatched_at = ?
           WHERE run_id = ?`,
          event.maaTaskId,
          now,
          event.runId,
        )
        break

      case 'TaskCompleted':
        this.sql.exec(
          `UPDATE runs SET state = ?, status = ?, finished_at = ?, payload = ?
           WHERE run_id = ?`,
          event.status,
          event.status === 'DONE' ? 'SUCCESS' : 'FAILED',
          now,
          event.payload ?? null,
          event.runId,
        )
        break

      case 'TaskAborted':
        this.sql.exec(
          `UPDATE runs SET state = 'ABORTED', status = 'ABORTED', finished_at = ?
           WHERE run_id = ?`,
          now,
          event.runId,
        )
        break

      case 'TaskLost':
        this.sql.exec(
          `UPDATE runs SET state = 'LOST', status = 'LOST', finished_at = ?
           WHERE run_id = ?`,
          now,
          event.runId,
        )
        break
    }
  }

  private scheduleAlarm(): void {
    if (!this.state?.nextWakeAt) {
      return
    }
    const wakeTime = new Date(this.state.nextWakeAt).getTime()
    if (wakeTime > Date.now()) {
      void this.ctx.storage.setAlarm(wakeTime)
    }
  }

  private applyCommand(command: Command): { state: InstanceState; events: DomainEvent[] } {
    if (!this.state) {
      throw new Error('State not initialized')
    }

    const result = reconcile(this.state, command)
    this.state = result.state
    this.saveState()
    this.emitEvents(result.events)
    this.scheduleAlarm()

    return result
  }

  override async alarm(): Promise<void> {
    const now = new Date().toISOString()
    this.applyCommand({ type: 'AlarmFired', now })
  }

  override async fetch(request: Request): Promise<Response> {
    this.syncInstanceId(request)

    const url = new URL(request.url)
    const path = url.pathname

    // MAA protocol internal routes
    if (path === '/maa/getTask') {
      return this.handleGetTask()
    }
    if (path === '/maa/reportStatus') {
      return this.handleReportStatus(request)
    }
    if (path === '/maa/deviceLog') {
      return this.handleDeviceLog(request)
    }

    // Dashboard API internal routes
    if (path.startsWith('/api/commands/')) {
      return this.handleCommand(request, path.slice('/api/commands/'.length))
    }
    if (path.startsWith('/api/')) {
      return this.handleQuery(path.slice('/api/'.length))
    }

    return new Response('Not Found', { status: 404 })
  }

  private handleGetTask(): Response {
    const now = new Date().toISOString()
    const result = this.applyCommand({ type: 'MaaGetTask', now })

    // Check if we have a task to dispatch
    const currentRun = result.state.currentRun
    if (currentRun && currentRun.state === 'DISPATCHED') {
      return this.jsonResponse({
        tasks: [
          {
            id: currentRun.maaTaskId,
            type: result.state.taskTemplate.maaTaskType,
            params: result.state.taskTemplate.params,
          },
        ],
      })
    }

    return this.jsonResponse({ tasks: [] })
  }

  private async handleReportStatus(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      task: string
      status?: string
      payload?: string
    }

    const now = new Date().toISOString()
    this.applyCommand({
      type: 'MaaReportStatus',
      now,
      maaTaskId: body.task,
      status: body.status,
      payload: body.payload,
    })

    return new Response('success')
  }

  private async handleDeviceLog(request: Request): Promise<Response> {
    const text = await request.text()
    const now = new Date().toISOString()

    // Store each line in the logs table
    const lines = text.split('\n').filter((line) => line.trim().length > 0)
    for (const line of lines) {
      this.sql.exec('INSERT INTO logs (at, text) VALUES (?, ?)', now, line)
    }

    // Also emit the event for history
    this.applyCommand({ type: 'MaaDeviceLog', now, text })

    return this.jsonResponse({ success: true })
  }

  private async handleCommand(request: Request, command: string): Promise<Response> {
    const body = (await request.json()) as {
      reason?: string
      policy?: Record<string, number>
      template?: Record<string, string>
      revision?: number
    }
    const actor = request.headers.get('X-Actor') ?? 'unknown'
    const now = new Date().toISOString()

    let cmd: Command

    switch (command) {
      case 'run-now':
        cmd = { type: 'RunNow', actor, now }
        break
      case 'abort-run':
        cmd = { type: 'AbortRun', actor, now }
        break
      case 'release-lock-lease':
        cmd = { type: 'ReleaseLockLease', actor, now }
        break
      case 'pause':
        cmd = { type: 'PauseAutomation', actor, reason: body.reason, now }
        break
      case 'resume':
        cmd = { type: 'ResumeAutomation', actor, now }
        break
      case 'set-schedule-policy':
        cmd = {
          type: 'SetSchedulePolicy',
          actor,
          patch: body.policy ?? {},
          now,
        }
        break
      case 'patch-task-template':
        cmd = {
          type: 'PatchTaskTemplate',
          actor,
          patch: body.template ?? {},
          now,
        }
        break
      case 'phone-lock':
        cmd = { type: 'PhoneLock', revision: body.revision, now }
        break
      case 'phone-unlock':
        cmd = { type: 'PhoneUnlock', revision: body.revision, now }
        break
      default:
        return this.jsonResponse({ error: `Unknown command: ${command}` }, 400)
    }

    const result = this.applyCommand(cmd)

    // Log config changes for audit
    if (command === 'set-schedule-policy' || command === 'patch-task-template') {
      this.sql.exec(
        'INSERT INTO config_revisions (at, actor, data) VALUES (?, ?, ?)',
        now,
        actor,
        JSON.stringify(cmd),
      )
    }

    return this.jsonResponse({ state: result.state, events: result.events })
  }

  private handleQuery(resource: string): Response {
    switch (resource) {
      case 'state':
        return this.jsonResponse(this.state)

      case 'runs': {
        const runs = this.sql
          .exec<{
            run_id: string
            maa_task_id: string
            generation: number
            state: string
            created_at: string
            dispatched_at: string | null
            finished_at: string | null
            status: string | null
            payload: string | null
          }>('SELECT * FROM runs ORDER BY created_at DESC LIMIT 100')
          .toArray()
        return this.jsonResponse(runs)
      }

      case 'events': {
        const events = this.sql
          .exec<{
            seq: number
            at: string
            type: string
            data: string
          }>('SELECT * FROM events ORDER BY seq DESC LIMIT 100')
          .toArray()
        return this.jsonResponse(
          events.map((e) => ({
            seq: e.seq,
            at: e.at,
            type: e.type,
            data: JSON.parse(e.data) as unknown,
          })),
        )
      }

      case 'logs': {
        const logs = this.sql
          .exec<{
            seq: number
            at: string
            text: string
          }>('SELECT * FROM logs ORDER BY seq DESC LIMIT 500')
          .toArray()
        return this.jsonResponse(logs)
      }

      case 'config': {
        const revisions = this.sql
          .exec<{
            seq: number
            at: string
            actor: string
            data: string
          }>('SELECT * FROM config_revisions ORDER BY seq DESC LIMIT 50')
          .toArray()
        return this.jsonResponse(
          revisions.map((r) => ({
            seq: r.seq,
            at: r.at,
            actor: r.actor,
            data: JSON.parse(r.data) as unknown,
          })),
        )
      }

      default:
        return this.jsonResponse({ error: `Unknown resource: ${resource}` }, 404)
    }
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
