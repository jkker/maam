import { describe, expect, it } from 'vite-plus/test'

import {
  MaaDeviceLogResponse,
  type MaaGetTaskRequest,
  MaaGetTaskResponse,
  type MaaReportStatusRequest,
  MAA_REPORT_STATUS_RESPONSE,
  validateGetTaskRequest,
  validateReportStatusRequest,
} from '#shared/protocol/maa'

describe('MAA Protocol - getTask', () => {
  it('validates correct getTask request', () => {
    const request = {
      user: 'user-123',
      device: 'device-456',
    }

    const result = validateGetTaskRequest(request)
    expect(result).toEqual(request)
  })

  it('rejects getTask request missing user', () => {
    const request = { device: 'device-456' }
    const result = validateGetTaskRequest(request)
    expect(result).toBeNull()
  })

  it('rejects getTask request missing device', () => {
    const request = { user: 'user-123' }
    const result = validateGetTaskRequest(request)
    expect(result).toBeNull()
  })

  it('accepts getTask request with extra fields', () => {
    const request = {
      user: 'user-123',
      device: 'device-456',
      extra: 'ignored',
    }

    const result = validateGetTaskRequest(request)
    // Arktype allows extra fields by default
    expect(result).not.toBeNull()
    expect(result?.user).toBe('user-123')
    expect(result?.device).toBe('device-456')
  })

  it('getTask response schema - empty tasks', () => {
    const response = { tasks: [] }
    const result = MaaGetTaskResponse(response)
    expect(result).toEqual(response)
  })

  it('getTask response schema - single task', () => {
    const response = {
      tasks: [
        {
          id: 'task-123',
          type: 'LinkStart',
        },
      ],
    }
    const result = MaaGetTaskResponse(response)
    expect(result).toEqual(response)
  })

  it('getTask response schema - task with params', () => {
    const response = {
      tasks: [
        {
          id: 'task-123',
          type: 'Settings-ConnectionAddress',
          params: '127.0.0.1:5555',
        },
      ],
    }
    const result = MaaGetTaskResponse(response)
    expect(result).toEqual(response)
  })
})

describe('MAA Protocol - reportStatus', () => {
  it('validates correct reportStatus request', () => {
    const request = {
      user: 'user-123',
      device: 'device-456',
      task: 'task-789',
      status: 'SUCCESS',
      payload: '',
    }

    const result = validateReportStatusRequest(request)
    expect(result).toEqual(request)
  })

  it('validates reportStatus request with minimal fields', () => {
    const request = {
      user: 'user-123',
      device: 'device-456',
      task: 'task-789',
    }

    const result = validateReportStatusRequest(request)
    expect(result).toEqual(request)
  })

  it('rejects reportStatus request missing task', () => {
    const request = {
      user: 'user-123',
      device: 'device-456',
    }
    const result = validateReportStatusRequest(request)
    expect(result).toBeNull()
  })

  it('reportStatus response is plain text "success"', () => {
    expect(MAA_REPORT_STATUS_RESPONSE).toBe('success')
  })
})

describe('MAA Protocol - deviceLog', () => {
  it('deviceLog response schema', () => {
    const response = { success: true }
    const result = MaaDeviceLogResponse(response)
    expect(result).toEqual(response)
  })

  it('deviceLog response with success false', () => {
    const response = { success: false }
    const result = MaaDeviceLogResponse(response)
    expect(result).toEqual(response)
  })
})

describe('MAA Protocol - request schema types', () => {
  it('MaaGetTaskRequest type check', () => {
    const request: MaaGetTaskRequest = {
      user: 'user-123',
      device: 'device-456',
    }
    expect(request.user).toBe('user-123')
    expect(request.device).toBe('device-456')
  })

  it('MaaReportStatusRequest type check', () => {
    const request: MaaReportStatusRequest = {
      user: 'user-123',
      device: 'device-456',
      task: 'task-789',
      status: 'SUCCESS',
      payload: 'base64-screenshot-data',
    }
    expect(request.task).toBe('task-789')
    expect(request.status).toBe('SUCCESS')
  })
})
