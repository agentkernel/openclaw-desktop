/**
 * Auth Profile 写入器
 * 路径：%USERPROFILE%\.openclaw\agents\main\agent\auth-profiles.json
 * 与 OpenClaw 原生一致（auth-profiles/paths.ts → resolveOpenClawAgentDir() + AUTH_PROFILE_FILENAME）
 * 格式与 OpenClaw CLI `openclaw onboard` 输出完全一致
 */

import fs from 'node:fs'
import path from 'node:path'
import { getUserDataDir } from '../utils/paths.js'

const AUTH_STORE_VERSION = 1
const AUTH_PROFILE_FILENAME = 'auth-profiles.json'
/** 与 OpenClaw agent-paths.ts resolveOpenClawAgentDir 一致：{stateDir}/agents/main/agent */
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

/** 历史错误路径（已废弃）：credentials/auth-profiles.json（早期误用 resolveOAuthDir） */
function resolveLegacyAuthStorePath(): string {
  return path.join(getUserDataDir(), 'credentials', AUTH_PROFILE_FILENAME)
}

function loadExistingStore(): AuthProfileStore {
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

/**
 * Migrate auth-profiles from legacy path (credentials/) to canonical path
 * (agents/main/agent/). Call at app startup so Gateway finds credentials.
 */
export function migrateAuthProfilesIfNeeded(): void {
  const canonicalPath = resolveAuthStorePath()
  if (fs.existsSync(canonicalPath)) return
  const legacyPath = resolveLegacyAuthStorePath()
  if (!fs.existsSync(legacyPath)) return
  try {
    const raw = fs.readFileSync(legacyPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.profiles && typeof parsed.profiles === 'object') {
      const agentAuthDir = resolveAgentAuthDir()
      fs.mkdirSync(agentAuthDir, { recursive: true })
      const store = { version: parsed.version ?? AUTH_STORE_VERSION, profiles: parsed.profiles }
      fs.writeFileSync(canonicalPath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
    }
  } catch {
    // migration failed, leave as-is
  }
}

/**
 * Write an API key credential to auth-profiles.json.
 * Merges with existing profiles (preserving other providers).
 * ProfileId format: `{provider}:default` (matches OpenClaw CLI convention).
 */
export function writeAuthProfile(provider: string, apiKey: string): void {
  const store = loadExistingStore()
  const profileId = `${provider}:default`

  store.profiles[profileId] = {
    type: 'api_key',
    provider,
    key: apiKey,
  }

  const agentAuthDir = resolveAgentAuthDir()
  fs.mkdirSync(agentAuthDir, { recursive: true })

  const storePath = resolveAuthStorePath()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

/**
 * Write a token credential (e.g. copilot-proxy:local) to auth-profiles.json.
 * Used for plugin providers that use token: "n/a" instead of API key.
 */
export function writeAuthProfileToken(profileId: string, provider: string, token: string): void {
  const store = loadExistingStore()
  store.profiles[profileId] = {
    type: 'token',
    provider,
    token,
  }
  const agentAuthDir = resolveAgentAuthDir()
  fs.mkdirSync(agentAuthDir, { recursive: true })
  const storePath = resolveAuthStorePath()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}
