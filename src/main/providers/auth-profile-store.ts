/**
 * Auth profiles: list/save/delete/import/export (same store as auth-profile-writer, LLM API UI).
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
  /** Masked key preview when maskKeys is true */
  keyPreview?: string
}

/**
 * List profiles with redacted secrets (api_key + token shapes)
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
 * Upsert api_key profile
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
 * Save token profile (e.g. copilot-proxy:local)
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
 * Delete profile by id
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
 * Serialize store to JSON
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
 * Import JSON into store (overwrites on conflict)
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
