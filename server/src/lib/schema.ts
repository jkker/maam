import * as z from 'zod'

export const IMMEDIATE_TASK = ['CaptureImageNow', 'StopTask', 'HeartBeat'] as const

export const TASK_TYPE = [
  ...IMMEDIATE_TASK,
  'CaptureImage',
  'LinkStart',
  'LinkStart-Base',
  'LinkStart-WakeUp',
  'LinkStart-Combat',
  'LinkStart-Recruiting',
  'LinkStart-Mall',
  'LinkStart-Mission',
  'LinkStart-AutoRoguelike',
  'LinkStart-Reclamation',
  'Settings-Stage1',
] as const

export const T = {
  LinkStart: '一键长草',
  'LinkStart-Base': '基地换班',
  'LinkStart-WakeUp': '自动唤醒',
  'LinkStart-Combat': '刷理智',
  'LinkStart-Recruiting': '自动公招',
  'LinkStart-Mall': '获取信用及购物',
  'LinkStart-Mission': '领取奖励',
  'LinkStart-AutoRoguelike': '自动肉鸽',
  'LinkStart-Reclamation': '生息演算',
  CaptureImageNow: '立即截图',
  CaptureImage: '截图',
  StopTask: '停止',
  HeartBeat: '测试链接',
  'Settings-Stage1': '关卡设置',
} as const

export const TASK_STAGE = ['PENDING', 'RUNNING', 'DONE'] as const
export const TASK_STATUS = ['PENDING', 'FAILED', 'SUCCESS'] as const

export const reportSchema = z.object({
  user: z.string(),
  device: z.string(),
  task: z.string(),
  status: z.enum(['FAILED', 'SUCCESS']),
  payload: z.string().optional(),
})

export const deviceSchema = z.object({
  device: z.string().min(10),
  user: z.string(),
})
export const scheduleSchema = z.object({
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59).default(0).optional(),
  task: z.enum(TASK_TYPE).optional().default('LinkStart'),
  params: z.string().optional(),
  timezone: z.string().optional(),
})

export type Schedule = z.infer<typeof scheduleSchema>

export type ScheduleWithMetadata = Schedule & {
  id: string
  lastRunTime?: string
  runCount?: number
  nextRunTime?: string
}

export const taskSchema = z.object({
  id: z.string(),
  type: z.enum(TASK_TYPE),
  params: z.string().optional(),
  stage: z.enum(TASK_STAGE),
  status: z.enum(TASK_STATUS).optional(),
  payload: z.string().optional(),
  createdAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  duration: z.number().optional(),
})

export type TaskRecord = z.infer<typeof taskSchema>
export type TaskType = TaskRecord['type']
export type ImmediateTask = (typeof IMMEDIATE_TASK)[number]
export type TaskStage = TaskRecord['stage']

export const logRecordSchema = z.object({
  timestamp: z.string(),
  title: z.string(),
  lines: z.array(
    z.object({
      timestamp: z.string(),
      src: z.string(),
      content: z.string(),
    }),
  ),
})

export type LogRecord = z.infer<typeof logRecordSchema>

export const logCodec = z.codec(z.string(), logRecordSchema, {
  decode: (str) => {
    // Split into main parts: timestamp|title|content
    const [timestampStr, title, content] = str.split('|', 3)
    // Parse main timestamp: "YYYY-MM-DD HH:mm:ss"
    const [, year, month, day, hour, minute, second] =
      timestampStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/) || []

    const timestamp = Temporal.PlainDateTime.from({
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: parseInt(hour),
      minute: parseInt(minute),
      second: parseInt(second),
    }).toString()

    // Parse the structured log lines from content
    // Format: [MM-DD  HH:mm:ss][Source]Message
    const lines: { timestamp: string; src: string; content: string }[] = []

    let match
    while (
      (match =
        /\[(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\]\[([^\]]+)\]([^\n]*(?:\n(?!\[)[^\n]*)*)/g.exec(
          content,
        )) !== null
    ) {
      const [, monthStr, dayStr, hourStr, minuteStr, secondStr, src, contentStr] = match

      // Determine the year based on the main timestamp
      // If the log line's month-day is after the main timestamp's, it's from previous year
      const lineMonth = parseInt(monthStr)
      const lineDay = parseInt(dayStr)
      const mainMonth = parseInt(month)
      const mainDay = parseInt(day)

      let lineYear = parseInt(year)
      if (lineMonth > mainMonth || (lineMonth === mainMonth && lineDay > mainDay)) {
        lineYear -= 1
      }

      const lineTimestamp = Temporal.PlainDateTime.from({
        year: lineYear,
        month: lineMonth,
        day: lineDay,
        hour: parseInt(hourStr),
        minute: parseInt(minuteStr),
        second: parseInt(secondStr),
      }).toString()

      lines.push({
        timestamp: lineTimestamp,
        src: src.trim(),
        content: contentStr.trim(),
      })
    }

    return {
      timestamp,
      title,
      lines,
    }
  },
  encode: (log) => {
    const lines = log.lines
      .map((line) => `[${line.timestamp}] [${line.src}] ${line.content}`)
      .join('\n')
    return `[${log.timestamp}] ${log.title}\n${lines}`
  },
})
export const ARKNIGHTS_TIME_ZONE = 'Asia/Shanghai'
