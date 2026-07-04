import { type } from 'arktype'

/**
 * MAA getTask request schema.
 */
export const MaaGetTaskRequest = type({
  user: 'string',
  device: 'string',
})

export type MaaGetTaskRequest = typeof MaaGetTaskRequest.infer

/**
 * MAA task item in response.
 */
export const MaaTask = type({
  id: 'string',
  type: 'string',
  'params?': 'string',
})

export type MaaTask = typeof MaaTask.infer

/**
 * MAA getTask response schema.
 */
export const MaaGetTaskResponse = type({
  tasks: MaaTask.array(),
})

export type MaaGetTaskResponse = typeof MaaGetTaskResponse.infer

/**
 * MAA reportStatus request schema.
 */
export const MaaReportStatusRequest = type({
  user: 'string',
  device: 'string',
  task: 'string',
  'status?': 'string',
  'payload?': 'string',
})

export type MaaReportStatusRequest = typeof MaaReportStatusRequest.infer

/**
 * MAA reportStatus response - plain text "success".
 */
export const MAA_REPORT_STATUS_RESPONSE = 'success'

/**
 * MAA deviceLog response schema.
 */
export const MaaDeviceLogResponse = type({
  success: 'boolean',
})

export type MaaDeviceLogResponse = typeof MaaDeviceLogResponse.infer

/**
 * Validates a MAA getTask request.
 */
export function validateGetTaskRequest(body: unknown): MaaGetTaskRequest | null {
  const result = MaaGetTaskRequest(body)
  if (result instanceof type.errors) {
    return null
  }
  return result
}

/**
 * Validates a MAA reportStatus request.
 */
export function validateReportStatusRequest(body: unknown): MaaReportStatusRequest | null {
  const result = MaaReportStatusRequest(body)
  if (result instanceof type.errors) {
    return null
  }
  return result
}
