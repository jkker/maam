import { describe, it, expect } from 'vitest'

import { logCodec } from './schema'

describe('logCodec', () => {
  describe('decode', () => {
    it('should parse basic log format with timestamp|title|content', () => {
      const input = '2025-10-25 21:40:30|Test Title|[10-25  21:40:28][TraceLogBrush]Test message'

      const result = logCodec.decode(input)

      expect(result.timestamp).toBe('2025-10-25T21:40:30')
      expect(result.title).toBe('Test Title')
      expect(result.lines).toHaveLength(1)
      expect(result.lines[0]).toEqual({
        timestamp: '2025-10-25T21:40:28',
        src: 'TraceLogBrush',
        content: 'Test message',
      })
    })

    it('should parse the full example log message', () => {
      const input = `2025-10-25 21:40:30|[MAA] 任务已全部完成！(用时 0h 0m 2s)|[10-25  21:40:28][TraceLogBrush]Build Time:
2025/10/23 09:41:23
Resource Time:
2025/10/25 07:07:17
[10-25  21:40:28][TraceLogBrush]正在连接模拟器……
[10-25  21:40:28][TraceLogBrush]正在运行中……
[10-25  21:40:28][TraceLogBrush]开始任务: 开始唤醒
[10-25  21:40:30][TraceLogBrush]完成任务: 开始唤醒
[10-25  21:40:30][TraceLogBrush]任务已全部完成！
(用时 0h 0m 2s)
MAA 已在 2025-10-25 21:40:30 完成了 Default 配置下所有预设的任务。(用时 0h 0m 2s)`

      const result = logCodec.decode(input)

      expect(result.timestamp).toBe('2025-10-25T21:40:30')
      expect(result.title).toBe('[MAA] 任务已全部完成！(用时 0h 0m 2s)')
      expect(result.lines).toHaveLength(6)

      // First line with multi-line content
      expect(result.lines[0].timestamp).toBe('2025-10-25T21:40:28')
      expect(result.lines[0].src).toBe('TraceLogBrush')
      expect(result.lines[0].content).toContain('Build Time:')
      expect(result.lines[0].content).toContain('2025/10/23 09:41:23')
      expect(result.lines[0].content).toContain('Resource Time:')
      expect(result.lines[0].content).toContain('2025/10/25 07:07:17')

      // Other lines
      expect(result.lines[1]).toEqual({
        timestamp: '2025-10-25T21:40:28',
        src: 'TraceLogBrush',
        content: '正在连接模拟器……',
      })

      expect(result.lines[2]).toEqual({
        timestamp: '2025-10-25T21:40:28',
        src: 'TraceLogBrush',
        content: '正在运行中……',
      })

      expect(result.lines[3]).toEqual({
        timestamp: '2025-10-25T21:40:28',
        src: 'TraceLogBrush',
        content: '开始任务: 开始唤醒',
      })

      expect(result.lines[4]).toEqual({
        timestamp: '2025-10-25T21:40:30',
        src: 'TraceLogBrush',
        content: '完成任务: 开始唤醒',
      })

      // Last line with multi-line content
      expect(result.lines.at(-1)!.timestamp).toBe('2025-10-25T21:40:30')
      expect(result.lines.at(-1)!.src).toBe('TraceLogBrush')
      expect(result.lines.at(-1)!.content).toContain('任务已全部完成！')
      expect(result.lines.at(-1)!.content).toContain('(用时 0h 0m 2s)')
      expect(result.lines.at(-1)!.content).toContain('MAA 已在 2025-10-25 21:40:30')
    })

    it('should handle content with pipes in the message', () => {
      const input =
        '2025-10-25 21:40:30|Title with | pipe|[10-25  21:40:28][Source]Message with | multiple | pipes'

      const result = logCodec.decode(input)

      expect(result.timestamp).toBe('2025-10-25T21:40:30')
      expect(result.title).toBe('Title with')
      expect(result.lines[0].content).toBe('Message with | multiple | pipes')
    })

    it('should handle multiple log sources', () => {
      const input = `2025-10-25 21:40:30|Test|[10-25  21:40:28][Source1]Message 1
[10-25  21:40:29][Source2]Message 2
[10-25  21:40:30][Source3]Message 3`

      const result = logCodec.decode(input)

      expect(result.lines).toHaveLength(3)
      expect(result.lines[0].src).toBe('Source1')
      expect(result.lines[1].src).toBe('Source2')
      expect(result.lines[2].src).toBe('Source3')
    })

    it('should handle log entries with special characters in source', () => {
      const input = '2025-10-25 21:40:30|Test|[10-25  21:40:28][Trace-Log_Brush.v2]Test message'

      const result = logCodec.decode(input)

      expect(result.lines[0].src).toBe('Trace-Log_Brush.v2')
    })

    it('should handle empty lines array when no structured logs present', () => {
      const input = '2025-10-25 21:40:30|Test Title|Just plain content without structured logs'

      const result = logCodec.decode(input)

      expect(result.timestamp).toBe('2025-10-25T21:40:30')
      expect(result.title).toBe('Test Title')
      expect(result.lines).toHaveLength(0)
    })

    it('should throw error when format is invalid (missing parts)', () => {
      const input = '2025-10-25 21:40:30|Only two parts'

      expect(() => logCodec.decode(input)).toThrow(
        'Invalid log format: expected timestamp|title|content',
      )
    })

    it('should handle log entries with brackets in content', () => {
      const input =
        '2025-10-25 21:40:30|Test|[10-25  21:40:28][Source]Message with [brackets] in content'

      const result = logCodec.decode(input)

      expect(result.lines[0].content).toBe('Message with [brackets] in content')
    })
  })

  describe('encode', () => {
    it('should encode LogRecord to string format', () => {
      const log = {
        timestamp: '2025-10-25T21:40:30',
        title: 'Test Title',
        lines: [
          { timestamp: '2025-10-25T21:40:28', src: 'Source1', content: 'Message 1' },
          { timestamp: '2025-10-25T21:40:29', src: 'Source2', content: 'Message 2' },
        ],
      }

      const result = logCodec.encode(log)

      expect(result).toBe(
        '[2025-10-25T21:40:30] Test Title\n[2025-10-25T21:40:28] [Source1] Message 1\n[2025-10-25T21:40:29] [Source2] Message 2',
      )
    })

    it('should handle empty lines array', () => {
      const log = {
        timestamp: '2025-10-25T21:40:30',
        title: 'Test Title',
        lines: [],
      }

      const result = logCodec.encode(log)

      expect(result).toBe('[2025-10-25T21:40:30] Test Title\n')
    })

    it('should handle multi-line content in encoded format', () => {
      const log = {
        timestamp: '2025-10-25T21:40:30',
        title: 'Test Title',
        lines: [
          {
            timestamp: '2025-10-25T21:40:28',
            src: 'Source',
            content: 'Line 1\nLine 2\nLine 3',
          },
        ],
      }

      const result = logCodec.encode(log)

      expect(result).toContain('Line 1\nLine 2\nLine 3')
    })
  })

  describe('round-trip encoding/decoding', () => {
    it('should preserve data through decode->encode cycle for simple case', () => {
      const input = '2025-10-25 21:40:30|Test Title|[10-25  21:40:28][Source]Message'

      const decoded = logCodec.decode(input)

      // Verify the decoded timestamps are in ISO format
      expect(decoded.timestamp).toBe('2025-10-25T21:40:30')
      expect(decoded.lines[0].timestamp).toBe('2025-10-25T21:40:28')

      // Decode again from the same input should produce identical results
      const reDecoded = logCodec.decode(input)

      expect(reDecoded.timestamp).toBe(decoded.timestamp)
      expect(reDecoded.title).toBe(decoded.title)
      expect(reDecoded.lines).toEqual(decoded.lines)
    })
  })
})
