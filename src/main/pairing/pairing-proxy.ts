import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type {
  FeishuApprovedSender,
  FeishuPairingRequest,
  PairingApproveResult,
  PairingListApprovedResult,
  PairingListPendingResult,
} from '../../shared/types.js'
import { getBundledNodePath, getBundledOpenClawDir, getBundledOpenClawPath, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

/** CLI can be slow on cold start; local approve avoids this when we have open_id */
const PAIRING_TIMEOUT_MS = 120_000
const FEISHU_CHANNEL = 'feishu' as const

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex -- strip ANSI color codes from CLI output
  return value.replace(/\x1b\[[0-9;]*m/g, '')
}

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

function buildCliEnv(): NodeJS.ProcessEnv {
  const nodePath = getBundledNodePath()
  return {
    ...withNodeInPath(process.env, nodePath),
    OPENCLAW_STATE_DIR: getUserDataDir(),
    OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
    OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
    NODE_ENV: 'production',
  }
}

function getCredentialsDir(): string {
  return path.join(getUserDataDir(), 'credentials')
}

/**
 * Upstream stores Feishu pairing next to allowlist files, e.g.:
 * - `feishu-default-pairing.json` (pairs with `feishu-default-allowFrom.json`)
 * - `feishu-pairing.json` (legacy / single-file)
 * - `feishu-<accountId>-pairing.json` (multi-account)
 */
function listFeishuPairingJsonPaths(): string[] {
  const dir = getCredentialsDir()
  if (!fs.existsSync(dir)) return []
  const names = fs.readdirSync(dir)
  const paths = new Set<string>()
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    if (name === 'feishu-pairing.json' || name === 'feishu-default-pairing.json') {
      paths.add(path.join(dir, name))
      continue
    }
    if (/^feishu-.+-pairing\.json$/.test(name)) {
      paths.add(path.join(dir, name))
    }
  }
  return [...paths].sort((a, b) => {
    const ba = path.basename(a)
    const bb = path.basename(b)
    if (ba === 'feishu-default-pairing.json') return -1
    if (bb === 'feishu-default-pairing.json') return 1
    if (ba === 'feishu-pairing.json') return -1
    if (bb === 'feishu-pairing.json') return 1
    return ba.localeCompare(bb)
  })
}

function getFeishuAllowFromPath(): string {
  return path.join(getCredentialsDir(), 'feishu-default-allowFrom.json')
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function pickNestedRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const nested = asRecord(source[key])
    if (nested) return nested
  }
  return null
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    const ts = Date.parse(value)
    return Number.isNaN(ts) ? value.trim() : new Date(ts).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  return undefined
}

function coercePairingCode(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function normalizePendingRequest(entry: unknown): FeishuPairingRequest | null {
  const record = asRecord(entry)
  if (!record) return null

  const sender = pickNestedRecord(record, ['sender', 'user', 'peer'])
  const meta = pickNestedRecord(record, ['meta'])
  const code =
    coercePairingCode(pickString(record, ['code', 'pairingCode', 'pairing_code', 'challenge', 'token', 'pairing', 'value']))
    ?? coercePairingCode(
      sender
        ? pickString(sender, ['pairingCode', 'pairing_code', 'code', 'challenge', 'token'])
        : undefined,
    )
    ?? coercePairingCode(meta ? pickString(meta, ['code', 'pairingCode', 'pairing_code', 'challenge']) : undefined)
  /** OpenClaw pairing store uses top-level `id` for the sender id (e.g. Feishu open_id). */
  const openId =
    pickString(record, [
      'openId',
      'openid',
      'open_id',
      'senderOpenId',
      'sender_open_id',
      'senderId',
      'sender_id',
      'userId',
      'user_id',
      'peerId',
      'peer_id',
      'id',
    ])
    ?? (sender
      ? pickString(sender, ['openId', 'openid', 'open_id', 'id', 'senderId', 'sender_id', 'userId', 'user_id'])
      : undefined)
    ?? (meta ? pickString(meta, ['openId', 'open_id', 'senderId', 'id']) : undefined)
  const displayName =
    pickString(record, ['displayName', 'display_name', 'senderName', 'sender_name', 'name'])
    ?? (sender ? pickString(sender, ['displayName', 'display_name', 'name']) : undefined)
  const createdAt =
    normalizeTimestamp(record.createdAt)
    ?? normalizeTimestamp(record.created_at)
    ?? normalizeTimestamp(record.requestedAt)
    ?? normalizeTimestamp(record.requested_at)
    ?? normalizeTimestamp(record.ts)
  const expiresAt =
    normalizeTimestamp(record.expiresAt)
    ?? normalizeTimestamp(record.expires_at)
    ?? normalizeTimestamp(record.expireAt)
    ?? normalizeTimestamp(record.expire_at)

  if (!code) return null
  return { code, openId, displayName, createdAt, expiresAt }
}

function extractRequestsArray(parsed: Record<string, unknown> | null): { key: 'requests' | 'pending'; items: unknown[] } | null {
  if (!parsed) return null
  if (Array.isArray(parsed.requests)) return { key: 'requests', items: parsed.requests }
  if (Array.isArray(parsed.pending)) return { key: 'pending', items: parsed.pending }
  return null
}

function mergePendingByCode(requests: FeishuPairingRequest[]): FeishuPairingRequest[] {
  const byCode = new Map<string, FeishuPairingRequest>()
  for (const req of requests) {
    const key = req.code.trim().toUpperCase()
    if (!key) continue
    if (!byCode.has(key)) byCode.set(key, { ...req, code: req.code.trim() })
  }
  return [...byCode.values()]
}

function readAllFeishuPendingFromDisk(): FeishuPairingRequest[] {
  const merged: FeishuPairingRequest[] = []
  for (const filePath of listFeishuPairingJsonPaths()) {
    const parsed = readJsonFile(filePath)
    const raw = extractRequestsArray(parsed)
    if (!raw) continue
    for (const item of raw.items) {
      const normalized = normalizePendingRequest(item)
      if (normalized) merged.push(normalized)
    }
  }
  return mergePendingByCode(merged)
}

function normalizeApprovedSenders(raw: unknown): FeishuApprovedSender[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((openId) => ({ openId: openId.trim() }))
}

function readApprovedSenders(): FeishuApprovedSender[] {
  const parsed = readJsonFile(getFeishuAllowFromPath())
  return normalizeApprovedSenders(parsed?.allowFrom)
}

function writeApprovedSenders(senders: FeishuApprovedSender[]): void {
  writeJsonFile(getFeishuAllowFromPath(), {
    version: 1,
    allowFrom: senders.map((sender) => sender.openId),
  })
}

function removePendingEntriesMatchingCode(targetCode: string): void {
  const key = targetCode.trim().toUpperCase()
  if (!key) return
  for (const filePath of listFeishuPairingJsonPaths()) {
    const parsed = readJsonFile(filePath)
    const raw = extractRequestsArray(parsed)
    if (!raw || !parsed) continue
    const filtered = raw.items.filter((item) => {
      const n = normalizePendingRequest(item)
      return !n || n.code.trim().toUpperCase() !== key
    })
    if (filtered.length === raw.items.length) continue
    ;(parsed as Record<string, unknown>)[raw.key] = filtered
    writeJsonFile(filePath, parsed)
  }
}

/**
 * Fast path: when we know the Feishu open_id, update allowlist and drop the pending row without waiting on CLI.
 */
function tryApproveFeishuLocally(code: string, openIdHint?: string): PairingApproveResult | null {
  const trimmed = code.trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  const pending = readAllFeishuPendingFromDisk()
  const match = pending.find((p) => p.code.trim().toUpperCase() === upper)
  const openId = (match?.openId ?? openIdHint)?.trim()
  if (!openId) return null

  const senders = readApprovedSenders()
  if (!senders.some((s) => s.openId === openId)) {
    senders.push({ openId })
    writeApprovedSenders(senders)
  }
  removePendingEntriesMatchingCode(trimmed)
  return {
    ok: true,
    messageId: 'local_approve_success',
    messageParams: { openId },
  }
}

function looksLikeFeishuApproveSuccess(text: string): boolean {
  const t = stripAnsi(text).toLowerCase()
  return (t.includes('approve') || t.includes('approved')) && t.includes('feishu')
}

function runPairingCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, [openclawPath, 'pairing', ...args], {
      cwd: getBundledOpenClawDir(),
      env: buildCliEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`pairing command timed out after ${PAIRING_TIMEOUT_MS}ms`))
    }, PAIRING_TIMEOUT_MS)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({
        exitCode: code ?? (signal ? 1 : 0),
        stdout,
        stderr,
      })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

export async function listPendingFeishuPairing(): Promise<PairingListPendingResult> {
  const requests = readAllFeishuPendingFromDisk()
  return {
    channel: FEISHU_CHANNEL,
    requests,
  }
}

export async function approveFeishuPairing(code: string, openIdHint?: string): Promise<PairingApproveResult> {
  const trimmed = code.trim()
  if (!trimmed) {
    return { ok: false, messageId: 'pairing_code_required' }
  }

  const local = tryApproveFeishuLocally(trimmed, openIdHint)
  if (local) {
    return local
  }

  const cliArgs = ['approve', FEISHU_CHANNEL, trimmed]
  if (openIdHint?.trim()) {
    cliArgs.push(openIdHint.trim())
  }

  try {
    const { exitCode, stdout, stderr } = await runPairingCli(cliArgs)
    const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
    const cleaned = stripAnsi(combined)
    const cliOk = exitCode === 0 || looksLikeFeishuApproveSuccess(combined)
    return {
      ok: cliOk,
      message: cleaned || undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message }
  }
}

export async function listApprovedFeishuSenders(): Promise<PairingListApprovedResult> {
  return {
    channel: FEISHU_CHANNEL,
    senders: readApprovedSenders(),
  }
}

export async function removeApprovedFeishuSender(openId: string): Promise<{ ok: boolean }> {
  const trimmed = openId.trim()
  if (!trimmed) {
    throw new Error('openId is required')
  }
  const next = readApprovedSenders().filter((sender) => sender.openId !== trimmed)
  writeApprovedSenders(next)
  return { ok: true }
}
