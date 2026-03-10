/**
 * Auth Profile 管理 — 列表、保存、删除、导入导出
 * 与 auth-profile-writer 共用存储路径和格式，供 LLM API 管理 UI 使用
 */

import fs from 'node:fs'
import path from 'node:path'
import { getUserDataDir } from '../utils/paths.js'

const AUTH_STORE_VERSION = 1
const AUTH_PROFILE_FILENAME = 'auth-profiles.json'
const AGENT_AUTH_DIR = ['agents', 'main', 'agent']

interface ApiKeyCredential {
  type: 'api_key'
  provider: string
  key: string
}

interface TokenCredential {
  type: 'token'
  provider: string
  token: string
}

type AuthProfileCredential = ApiKeyCredential | TokenCredential

interface AuthProfileStore {
  version: number
  profiles: Record<string, AuthProfileCredential>
}

function resolveAgentAuthDir(): string {
  return path.join(getUserDataDir(), ...AGENT_AUTH_DIR)
}

function resolveAuthStorePath(): string {
  return path.join(resolveAgentAuthDir(), AUTH_PROFILE_FILENAME)
}

function resolveLegacyAuthStorePath(): string {
  return path.join(getUserDataDir(), 'credentials', AUTH_PROFILE_FILENAME)
}

function loadStore(): AuthProfileStore {
  const storePath = resolveAuthStorePath()
  try {
    if (!fs.existsSync(storePath)) {
      const legacyPath = resolveLegacyAuthStorePath()
      if (fs.existsSync(legacyPath)) {
        const raw = fs.readFileSync(legacyPath, 'utf-8')
        const parsed = JSON.parse(raw)
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.profiles &&
          typeof parsed.profiles === 'object'
        ) {
          const store = {
            version: parsed.version ?? AUTH_STORE_VERSION,
            profiles: parsed.profiles,
          }
          const agentAuthDir = resolveAgentAuthDir()
          fs.mkdirSync(agentAuthDir, { recursive: true })
          fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
          return store as AuthProfileStore
        }
      }
      return { version: AUTH_STORE_VERSION, profiles: {} }
    }
    const raw = fs.readFileSync(storePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.version === 'number' &&
      parsed.profiles &&
      typeof parsed.profiles === 'object'
    ) {
      return parsed as AuthProfileStore
    }
    return { version: AUTH_STORE_VERSION, profiles: {} }
  } catch {
    return { version: AUTH_STORE_VERSION, profiles: {} }
  }
}

function saveStore(store: AuthProfileStore): void {
  const agentAuthDir = resolveAgentAuthDir()
  fs.mkdirSync(agentAuthDir, { recursive: true })
  const storePath = resolveAuthStorePath()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

function hasCredential(cred: AuthProfileCredential): boolean {
  if (cred.type === 'api_key') return Boolean(cred.key?.length)
  if (cred.type === 'token') return Boolean(cred.token?.length)
  return false
}

function getCredentialPreview(cred: AuthProfileCredential, mask: boolean): string | undefined {
  const val = cred.type === 'api_key' ? cred.key : cred.token
  if (!val?.length) return undefined
  return mask ? val.slice(0, 4) + '***' : val
}

export interface AuthProfileItem {
  profileId: string
  provider: string
  hasKey: boolean
  /** 脱敏后的 key 预览，仅当 maskKeys 时返回 */
  keyPreview?: string
}

/**
 * 列表所有 auth profile，key/token 脱敏
 * 支持 api_key 与 token 两种凭证类型（与原生 auth-profiles store 兼容）
 */
export function listAuthProfiles(maskKeys = true): AuthProfileItem[] {
  const store = loadStore()
  return Object.entries(store.profiles).map(([profileId, cred]) => {
    const preview = getCredentialPreview(cred, maskKeys)
    return {
      profileId,
      provider: cred.provider,
      hasKey: hasCredential(cred),
      ...(preview ? { keyPreview: preview } : {}),
    }
  })
}

/**
 * 保存或更新 auth profile
 */
export function saveAuthProfile(profileId: string, provider: string, apiKey: string): void {
  const store = loadStore()
  store.profiles[profileId] = {
    type: 'api_key',
    provider,
    key: apiKey,
  }
  saveStore(store)
}

/**
 * 保存 token 凭证（如 copilot-proxy:local）
 * 与 auth-profile-writer.writeAuthProfileToken 格式一致
 */
export function saveAuthProfileToken(profileId: string, provider: string, token: string): void {
  const store = loadStore()
  store.profiles[profileId] = {
    type: 'token',
    provider,
    token,
  }
  saveStore(store)
}

/**
 * 删除 auth profile
 */
export function deleteAuthProfile(profileId: string): void {
  const store = loadStore()
  delete store.profiles[profileId]
  saveStore(store)
}

export interface ExportAuthProfilesOptions {
  maskKeys?: boolean
}

/**
 * 导出 auth profiles 为 JSON 字符串
 */
export function exportAuthProfiles(opts: ExportAuthProfilesOptions = {}): string {
  const { maskKeys = true } = opts
  const store = loadStore()
  const out = {
    version: store.version,
    profiles: {} as Record<string, AuthProfileCredential>,
  }
  for (const [id, cred] of Object.entries(store.profiles)) {
    if (cred.type === 'api_key') {
      out.profiles[id] = {
        ...cred,
        key: maskKeys && cred.key ? cred.key.slice(0, 4) + '***' : cred.key,
      }
    } else {
      out.profiles[id] = {
        ...cred,
        token: maskKeys && cred.token ? cred.token.slice(0, 4) + '***' : cred.token,
      }
    }
  }
  return JSON.stringify(out, null, 2)
}

export interface ImportAuthProfilesResult {
  imported: number
  errors: string[]
}

/**
 * 从 JSON 字符串导入 auth profiles，合并到现有 store（冲突覆盖）
 */
export function importAuthProfiles(json: string): ImportAuthProfilesResult {
  const errors: string[] = []
  let imported = 0
  try {
    const parsed = JSON.parse(json) as AuthProfileStore
    if (!parsed || typeof parsed !== 'object' || !parsed.profiles || typeof parsed.profiles !== 'object') {
      errors.push('Invalid format: missing profiles object')
      return { imported: 0, errors }
    }
    const store = loadStore()
    for (const [profileId, cred] of Object.entries(parsed.profiles)) {
      if (!cred || typeof cred !== 'object' || typeof cred.provider !== 'string') continue
      if (
        cred.type === 'api_key' &&
        typeof cred.key === 'string' &&
        cred.key.length > 0 &&
        !cred.key.endsWith('***')
      ) {
        store.profiles[profileId] = cred
        imported++
      } else if (cred.type === 'token' && typeof cred.token === 'string' && cred.token.length > 0 && !cred.token.endsWith('***')) {
        store.profiles[profileId] = cred
        imported++
      } else if ((cred as ApiKeyCredential).key?.endsWith('***') || (cred as TokenCredential).token?.endsWith('***')) {
        errors.push(`Profile ${profileId}: cannot import masked credential, provide plain value`)
      }
    }
    saveStore(store)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }
  return { imported, errors }
}
