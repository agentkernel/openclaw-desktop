/**
 * 结构化日志聚合器 — 环形缓冲区，供诊断包导出与 UI 查询
 */

export interface StructuredLog {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  source: 'shell' | 'gateway' | 'install-validation'
  message: string
}

const DEFAULT_CAPACITY = 5000

export class LogAggregator {
  private readonly buffer: StructuredLog[] = []
  private readonly capacity: number
  private tail = 0

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity
  }

  append(source: StructuredLog['source'], level: StructuredLog['level'], message: string): void {
    try {
      const entry: StructuredLog = {
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
      }
      if (this.buffer.length < this.capacity) {
        this.buffer.push(entry)
      } else {
        this.buffer[this.tail] = entry
        this.tail = (this.tail + 1) % this.capacity
      }
    } catch {
      // Ignore aggregation failures
    }
  }

  getRecent(count = 1000): StructuredLog[] {
    if (this.buffer.length <= count) {
      return [...this.buffer]
    }
    const start = this.buffer.length - count
    return this.buffer.slice(start)
  }

  clear(): void {
    this.buffer.length = 0
    this.tail = 0
  }
}

let defaultAggregator: LogAggregator | null = null

export function getLogAggregator(): LogAggregator {
  if (!defaultAggregator) {
    defaultAggregator = new LogAggregator()
  }
  return defaultAggregator
}
