/**
 * Gateway 日志行解析 — 将 stdout/stderr 行解析为 StructuredLog
 * 支持 JSON 行（pino 格式）和纯文本
 */

import type { StructuredLog } from '../diagnostics/log-aggregator.js'

type LogLevel = 'info' | 'warn' | 'error'

function normalizeLevel(level: unknown): LogLevel {
  if (typeof level !== 'string') return 'info'
  const l = level.toLowerCase()
  if (l === 'error' || l === 'fatal') return 'error'
  if (l === 'warn' || l === 'warning') return 'warn'
  return 'info'
}

/**
 * 解析 Gateway 输出行为 StructuredLog
 * @param line 原始行内容
 * @param stream stdout 或 stderr
 */
export function parseGatewayLogLine(line: string, stream: 'stdout' | 'stderr'): StructuredLog {
  const fallbackLevel: LogLevel = stream === 'stderr' ? 'error' : 'info'
  const fallbackTimestamp = new Date().toISOString()

  const trimmed = line.trim()
  if (!trimmed) {
    return {
      timestamp: fallbackTimestamp,
      level: fallbackLevel,
      source: 'gateway',
      message: line,
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        timestamp: fallbackTimestamp,
        level: fallbackLevel,
        source: 'gateway',
        message: line,
      }
    }

    const time = typeof parsed.time === 'number' ? new Date(parsed.time).toISOString() : undefined
    const timeStr = typeof parsed.time === 'string' ? parsed.time : time
    const level = normalizeLevel(parsed.level)
    const message = typeof parsed.msg === 'string' ? parsed.msg : typeof parsed.message === 'string' ? parsed.message : trimmed

    return {
      timestamp: timeStr ?? fallbackTimestamp,
      level,
      source: 'gateway',
      message,
    }
  } catch {
    return {
      timestamp: fallbackTimestamp,
      level: fallbackLevel,
      source: 'gateway',
      message: trimmed,
    }
  }
}
