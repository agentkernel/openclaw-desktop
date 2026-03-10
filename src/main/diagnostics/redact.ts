/**
 * 脱敏工具 — 用于诊断包导出，避免泄露 API Key / Token / 路径
 */

const REDACTED = '***REDACTED***'
const USER_HOME_PLACEHOLDER = '[USER_HOME]'

const SENSITIVE_KEYS = new Set([
  'apiKey',
  'api_key',
  'api-key',
  'token',
  'secret',
  'password',
  'credentials',
  'authorization',
  'Authorization',
  'x-api-key',
  'X-Api-Key',
])

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key)
}

export function redactConfig(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactConfig(item))
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && isSensitiveKey(k)) {
        result[k] = v.length > 0 ? REDACTED : ''
      } else {
        result[k] = redactConfig(v)
      }
    }
    return result
  }
  return obj
}

export function redactPath(p: string): string {
  if (!p || typeof p !== 'string') return p
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
  if (home && p.includes(home)) {
    return p.replace(new RegExp(escapeRegex(home), 'gi'), USER_HOME_PLACEHOLDER)
  }
  if (p.includes('%USERPROFILE%') || p.includes('$HOME')) {
    return p.replace(/%USERPROFILE%|%HOME%|\$HOME/gi, USER_HOME_PLACEHOLDER)
  }
  return p
}

/** 脱敏日志消息中的 API Key、Token、路径 */
export function redactLogMessage(text: string): string {
  if (!text || typeof text !== 'string') return text
  let out = redactPath(text)
  // OpenAI API key: sk-xxx
  out = out.replace(/sk-[a-zA-Z0-9-]{20,}/g, REDACTED)
  // Anthropic API key
  out = out.replace(/sk-ant-[a-zA-Z0-9-]+/g, REDACTED)
  // Bearer token
  out = out.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, `Bearer ${REDACTED}`)
  // Generic long alphanumeric (likely key/token)
  out = out.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, REDACTED)
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
