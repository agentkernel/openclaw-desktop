/**
 * OpenClaw main config read/write.
 * Path: %USERPROFILE%\.openclaw\openclaw.json (JSON5).
 * Aligned with upstream OpenClaw config/io load flow.
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import JSON5 from 'json5'
import type { OpenClawConfig } from '../../shared/types.js'
import { getBundledOpenClawDir, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

function getOpenClawConfigPath(): string {
  return path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
}

function buildDefaultProviderModel(modelId: string): Record<string, unknown> & { id: string; name: string } {
  return {
    id: modelId,
    name: modelId,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  }
}

function getPrimaryModelRef(config: OpenClawConfig): string | undefined {
  const model = config?.agents?.defaults?.model
  if (typeof model === 'string') return model
  if (model && typeof model === 'object') {
    const primary = (model as { primary?: unknown }).primary
    if (typeof primary === 'string') return primary
  }
  return undefined
}

function inferModelIdFromConfig(config: OpenClawConfig, providerId: string): string | undefined {
  const primary = getPrimaryModelRef(config)
  if (primary?.startsWith(`${providerId}/`)) {
    const id = primary.slice(providerId.length + 1).trim()
    if (id) return id
  }

  const aliases = config?.agents?.defaults?.models
  if (aliases && typeof aliases === 'object') {
    for (const modelRef of Object.keys(aliases)) {
      if (!modelRef.startsWith(`${providerId}/`)) continue
      const id = modelRef.slice(providerId.length + 1).trim()
      if (id) return id
    }
  }

  return undefined
}

function migrateLegacyProviderConfig(config: OpenClawConfig): { config: OpenClawConfig; changed: boolean } {
  const providers = config?.models?.providers
  if (!providers || typeof providers !== 'object') {
    return { config, changed: false }
  }

  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const nextProviders = next.models?.providers
  if (!nextProviders || typeof nextProviders !== 'object') {
    return { config, changed: false }
  }

  let changed = false
  for (const [providerId, rawProviderConfig] of Object.entries(nextProviders)) {
    if (!rawProviderConfig || typeof rawProviderConfig !== 'object' || Array.isArray(rawProviderConfig)) {
      continue
    }

    const providerConfig = rawProviderConfig as Record<string, unknown>
    const compatibility = providerConfig.compatibility
    if (compatibility === 'openai' || compatibility === 'anthropic') {
      if (typeof providerConfig.api !== 'string' || providerConfig.api.trim().length === 0) {
        providerConfig.api = compatibility === 'anthropic' ? 'anthropic-messages' : 'openai-completions'
      }
    }
    if ('compatibility' in providerConfig) {
      delete providerConfig.compatibility
      changed = true
    }

    const models = providerConfig.models
    if (!Array.isArray(models) || models.length === 0) {
      const inferredModelId = inferModelIdFromConfig(next, providerId)
      providerConfig.models = [buildDefaultProviderModel(inferredModelId ?? 'default')]
      changed = true
    }
  }

  if (!changed) {
    return { config, changed: false }
  }
  return { config: next, changed: true }
}

/** Ensure Feishu channel keeps explicit `dmPolicy: pairing` so DMs use pairing flow (not implicit open). */
/**
 * OpenClaw 2026.3+ rejects Control UI WebSocket connects without device identity unless
 * `gateway.controlUi.allowInsecureAuth` is set. The desktop embeds Control UI in a sandboxed
 * iframe where `crypto.subtle` may be missing — enable this for local (non-remote) gateways.
 */
function migrateDesktopControlUiAllowInsecureAuth(
  config: OpenClawConfig,
): { config: OpenClawConfig; changed: boolean } {
  const gw = config.gateway
  if (!gw || typeof gw !== 'object') {
    return { config, changed: false }
  }
  if (gw.mode === 'remote') {
    return { config, changed: false }
  }
  const ctrl = gw.controlUi
  if (ctrl && typeof ctrl === 'object' && ctrl.allowInsecureAuth !== undefined) {
    return { config, changed: false }
  }
  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const ng = next.gateway
  if (!ng || typeof ng !== 'object') {
    return { config, changed: false }
  }
  ng.controlUi = {
    ...(typeof ng.controlUi === 'object' && ng.controlUi !== null ? ng.controlUi : {}),
    allowInsecureAuth: true,
  }
  return { config: next, changed: true }
}

/**
 * OpenClaw 2026.1.29+: gateway auth mode `none` removed — gateway must use token or password.
 * Migrate legacy `mode: "none"` using whichever credential field is present.
 */
function migrateGatewayAuthModeNoneRemoved(
  config: OpenClawConfig,
): { config: OpenClawConfig; changed: boolean } {
  const gw = config.gateway
  const auth = gw && typeof gw === 'object' ? gw.auth : undefined
  if (!auth || typeof auth !== 'object') {
    return { config, changed: false }
  }
  const mode = (auth as Record<string, unknown>).mode
  if (mode !== 'none') {
    return { config, changed: false }
  }

  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const na = next.gateway?.auth
  if (!na || typeof na !== 'object') {
    return { config, changed: false }
  }
  const token = typeof na.token === 'string' ? na.token.trim() : ''
  const rawPw = (na as Record<string, unknown>).password
  const password = typeof rawPw === 'string' ? rawPw.trim() : ''
  if (token) {
    na.mode = 'token'
  } else if (password) {
    na.mode = 'password'
  } else {
    delete na.mode
  }
  return { config: next, changed: true }
}

function migrateFeishuDmPolicy(config: OpenClawConfig): { config: OpenClawConfig; changed: boolean } {
  const feishu = config.channels?.feishu
  if (!feishu || typeof feishu !== 'object' || Array.isArray(feishu)) {
    return { config, changed: false }
  }
  const f = feishu as Record<string, unknown>
  if (f.dmPolicy !== undefined && f.dmPolicy !== null && String(f.dmPolicy).trim() !== '') {
    return { config, changed: false }
  }
  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const nf = next.channels?.feishu as Record<string, unknown> | undefined
  if (!nf || typeof nf !== 'object' || Array.isArray(nf)) {
    return { config, changed: false }
  }
  nf.dmPolicy = 'pairing'
  return { config: next, changed: true }
}

/** Control UI Vite output is always index.html + assets/*.js — drop stale roots (other PC, or index-only trap). */
function isUsableControlUiBundleDir(dir: string): boolean {
  const indexPath = path.join(dir, 'index.html')
  if (!fs.existsSync(indexPath)) return false
  const assetsDir = path.join(dir, 'assets')
  try {
    if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) return false
    return fs.readdirSync(assetsDir).some((f) => f.endsWith('.js'))
  } catch {
    return false
  }
}

function normalizeAbsPathForCompare(p: string): string {
  return path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()
}

function isPathEqualOrNested(baseDir: string, candidate: string): boolean {
  const base = normalizeAbsPathForCompare(baseDir)
  const target = normalizeAbsPathForCompare(candidate)
  if (base === target) return true
  return target.startsWith(`${base}${path.sep}`.toLowerCase())
}

/**
 * Remove gateway.controlUi.root when it does not point at a built Control UI (broken embed + black browser tab).
 * Packaged local installs: always drop `controlUi.root` so the gateway serves Control UI from bundled OpenClaw cwd only
 * (avoids stale absolute paths and index.html vs assets mismatch after reinstall or mixed artifacts).
 */
function migrateInvalidGatewayControlUiRoot(config: OpenClawConfig): { config: OpenClawConfig; changed: boolean } {
  const gw = config.gateway
  if (!gw || typeof gw !== 'object') return { config, changed: false }
  const ctrl = gw.controlUi
  if (!ctrl || typeof ctrl !== 'object' || Array.isArray(ctrl)) return { config, changed: false }
  const rootRaw = (ctrl as Record<string, unknown>).root
  if (typeof rootRaw !== 'string' || !rootRaw.trim()) return { config, changed: false }

  if (app.isPackaged && gw.mode !== 'remote') {
    const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
    const ng = next.gateway?.controlUi as Record<string, unknown> | undefined
    if (ng && typeof ng === 'object' && !Array.isArray(ng)) {
      delete ng.root
    }
    return { config: next, changed: true }
  }

  let dir: string
  try {
    const abs = path.resolve(rootRaw.trim())
    const st = fs.statSync(abs)
    dir = st.isFile() && abs.toLowerCase().endsWith('.html') ? path.dirname(abs) : abs
  } catch {
    dir = ''
  }

  if (dir && isUsableControlUiBundleDir(dir)) {
    // Desktop local mode should serve the bundled Control UI; stale custom roots from older installs
    // can be "valid" files but incompatible with current gateway/auth behavior and render as a black page.
    if (gw.mode !== 'remote') {
      const bundledControlUiDir = path.join(getBundledOpenClawDir(), 'dist', 'control-ui')
      if (!isPathEqualOrNested(bundledControlUiDir, dir)) {
        const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
        const ng = next.gateway?.controlUi as Record<string, unknown> | undefined
        if (ng && typeof ng === 'object' && !Array.isArray(ng)) {
          delete ng.root
        }
        return { config: next, changed: true }
      }
    }
    return { config, changed: false }
  }

  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const ng = next.gateway?.controlUi as Record<string, unknown> | undefined
  if (ng && typeof ng === 'object' && !Array.isArray(ng)) {
    delete ng.root
  }
  return { config: next, changed: true }
}

/**
 * Read OpenClaw main config.
 * - Missing file → {}
 * - Parse error → {} + warning
 */
export function readOpenClawConfig(): OpenClawConfig {
  const configPath = getOpenClawConfigPath()
  try {
    if (!fs.existsSync(configPath)) {
      return {}
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON5.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      let cfg = parsed as OpenClawConfig
      const migratedProviders = migrateLegacyProviderConfig(cfg)
      cfg = migratedProviders.config
      const migratedFeishu = migrateFeishuDmPolicy(cfg)
      cfg = migratedFeishu.config
      const migratedControlUiRoot = migrateInvalidGatewayControlUiRoot(cfg)
      cfg = migratedControlUiRoot.config
      const migratedControlUi = migrateDesktopControlUiAllowInsecureAuth(cfg)
      cfg = migratedControlUi.config
      const migratedAuthNone = migrateGatewayAuthModeNoneRemoved(cfg)
      cfg = migratedAuthNone.config
      if (
        migratedProviders.changed ||
        migratedFeishu.changed ||
        migratedControlUiRoot.changed ||
        migratedControlUi.changed ||
        migratedAuthNone.changed
      ) {
        try {
          writeOpenClawConfig(cfg)
          if (migratedProviders.changed) {
            console.info('[config] Migrated legacy provider fields in openclaw.json')
          }
          if (migratedFeishu.changed) {
            console.info('[config] Migrated Feishu dmPolicy to pairing in openclaw.json')
          }
          if (migratedControlUiRoot.changed) {
            console.info(
              '[config] Adjusted gateway.controlUi.root so Control UI loads from the bundled OpenClaw tree (avoids stale paths / black screen).',
            )
          }
          if (migratedControlUi.changed) {
            console.info(
              '[config] Set gateway.controlUi.allowInsecureAuth=true for embedded Control UI (OpenClaw 2026.3+)',
            )
          }
          if (migratedAuthNone.changed) {
            console.info('[config] Migrated gateway.auth.mode from "none" (removed upstream) in openclaw.json')
          }
        } catch (err) {
          console.warn(
            '[config] Failed to persist migrated openclaw config:',
            err instanceof Error ? err.message : String(err),
          )
        }
      }
      return cfg
    }
    return {}
  } catch (err) {
    console.warn(
      `[config] OpenClaw config parse failed, using defaults: ${configPath}`,
      err instanceof Error ? err.message : String(err)
    )
    return {}
  }
}

/**
 * Write OpenClaw main config as standard JSON (tool-friendly).
 */
export function writeOpenClawConfig(config: OpenClawConfig): void {
  const configPath = getOpenClawConfigPath()
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true })
  const data = JSON.stringify(config, null, 2) + '\n'
  const tmpPath = `${configPath}.tmp`
  fs.writeFileSync(tmpPath, data, 'utf-8')
  try {
    fs.renameSync(tmpPath, configPath)
  } catch {
    // Windows: rename fails if target exists; remove it and retry
    fs.unlinkSync(configPath)
    fs.renameSync(tmpPath, configPath)
  }
}

/** Whether the OpenClaw config file exists */
export function openclawConfigExists(): boolean {
  return fs.existsSync(getOpenClawConfigPath())
}
