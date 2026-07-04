import type { InstanceState } from './state'

/**
 * Phone lock command - blocks automation.
 */
export interface PhoneLockCommand {
  type: 'PhoneLock'
  revision?: number | undefined
  now: string
}

/**
 * Phone unlock command - starts cooldown.
 */
export interface PhoneUnlockCommand {
  type: 'PhoneUnlock'
  revision?: number | undefined
  now: string
}

/**
 * Manual run trigger.
 */
export interface RunNowCommand {
  type: 'RunNow'
  actor: string
  now: string
}

/**
 * Abort current run.
 */
export interface AbortRunCommand {
  type: 'AbortRun'
  actor: string
  now: string
}

/**
 * Manually release lock lease.
 */
export interface ReleaseLockLeaseCommand {
  type: 'ReleaseLockLease'
  actor: string
  now: string
}

/**
 * Pause automation.
 */
export interface PauseAutomationCommand {
  type: 'PauseAutomation'
  actor: string
  reason?: string | undefined
  now: string
}

/**
 * Resume automation.
 */
export interface ResumeAutomationCommand {
  type: 'ResumeAutomation'
  actor: string
  now: string
}

/**
 * Update schedule policy.
 */
export interface SetSchedulePolicyCommand {
  type: 'SetSchedulePolicy'
  actor: string
  patch: Partial<InstanceState['schedulePolicy']>
  now: string
}

/**
 * Update task template.
 */
export interface PatchTaskTemplateCommand {
  type: 'PatchTaskTemplate'
  actor: string
  patch: Partial<InstanceState['taskTemplate']>
  now: string
}

/**
 * MAA getTask poll - may dispatch a task.
 */
export interface MaaGetTaskCommand {
  type: 'MaaGetTask'
  now: string
}

/**
 * MAA reportStatus - task completion report.
 */
export interface MaaReportStatusCommand {
  type: 'MaaReportStatus'
  now: string
  maaTaskId: string
  status?: string | undefined
  payload?: string | undefined
}

/**
 * MAA deviceLog - log ingestion.
 */
export interface MaaDeviceLogCommand {
  type: 'MaaDeviceLog'
  now: string
  text: string
}

/**
 * Alarm fired - scheduled wake-up.
 */
export interface AlarmFiredCommand {
  type: 'AlarmFired'
  now: string
}

/**
 * All command types.
 */
export type Command =
  | PhoneLockCommand
  | PhoneUnlockCommand
  | RunNowCommand
  | AbortRunCommand
  | ReleaseLockLeaseCommand
  | PauseAutomationCommand
  | ResumeAutomationCommand
  | SetSchedulePolicyCommand
  | PatchTaskTemplateCommand
  | MaaGetTaskCommand
  | MaaReportStatusCommand
  | MaaDeviceLogCommand
  | AlarmFiredCommand
