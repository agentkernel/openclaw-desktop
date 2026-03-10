import fs from 'node:fs'
import path from 'node:path'
import { getUserDataDir } from './paths.js'
import { getLogAggregator } from '../diagnostics/log-aggregator.js'

let logFilePath: string | null = null

function ensureLogFile(): string {
  if (logFilePath) return logFilePath
  const dir = path.join(getUserDataDir(), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  logFilePath = path.join(dir, 'shell.log')
  return logFilePath
}

/**
 * 在 Windows 控制台输出前将 Unicode 符号替换为 ASCII，避免 GBK 等非 UTF-8 代码页下的乱码。
 * Gateway (OpenClaw) 的 pino 日志常见 → ✓ ✗ 等符号，在 PowerShell/CMD 默认编码下会显示为 鈬? 鉁?。
 */
function sanitizeForConsole(message: string): string {
  if (process.platform !== 'win32') return message
  return message
    .replace(/\u2192/g, '->') // →
    .replace(/\u2713/g, '[ok]') // ✓
    .replace(/\u2717/g, '[x]') // ✗
    .replace(/\u2714/g, '[ok]') // ✔
    .replace(/\u274c/g, '[x]') // ❌
    .replace(/\u2705/g, '[ok]') // ✅
    .replace(/\u2013/g, '-') // – (en-dash)
    .replace(/\u2014/g, '-') // — (em-dash)
}

function formatLine(level: string, message: string): string {
  const ts = new Date().toISOString()
  return `[${ts}] [${level}] ${message}\n`
}

export function initShellLog(): void {
  try {
    const file = ensureLogFile()
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, formatLine('info', 'Shell log initialized'), 'utf-8')
    }
  } catch {
    // ignore logging failures
  }
}

export function logToFile(level: 'info' | 'warn' | 'error', message: string): void {
  try {
    const file = ensureLogFile()
    fs.appendFileSync(file, formatLine(level, message), 'utf-8')
  } catch {
    // ignore logging failures
  }
}

export function logInfo(message: string): void {
  console.info(sanitizeForConsole(message))
  logToFile('info', message)
  try {
    getLogAggregator().append('shell', 'info', message)
  } catch {
    // ignore
  }
}

export function logWarn(message: string): void {
  console.warn(sanitizeForConsole(message))
  logToFile('warn', message)
  try {
    getLogAggregator().append('shell', 'warn', message)
  } catch {
    // ignore
  }
}

export function logError(message: string): void {
  console.error(sanitizeForConsole(message))
  logToFile('error', message)
  try {
    getLogAggregator().append('shell', 'error', message)
  } catch {
    // ignore
  }
}
