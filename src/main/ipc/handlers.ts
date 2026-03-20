import { app, ipcMain, shell } from 'electron'
import type { GatewayProcessManager } from '../gateway/index.js'
import type { OpenClawConfig, ShellConfig, AppVersionInfo, ModelConfig, WizardState } from '../../shared/types.js'
import type { PortCheckResult } from '../utils/port-check.js'
import { testModelConnection } from '../wizard/model-tester.js'
import { handleWizardCompleteSetup } from '../wizard/setup-handler.js'
import { DEFAULT_GATEWAY_PORT } from '../../shared/constants.js'
import {
  IPC_GATEWAY_START,
  IPC_GATEWAY_STOP,
  IPC_GATEWAY_RESTART,
  IPC_GATEWAY_STATUS,
  IPC_CONFIG_READ,
  IPC_CONFIG_WRITE,
  IPC_CONFIG_EXISTS,
  IPC_CONFIG_VALIDATE,
  IPC_SHELL_GET_CONFIG,
  IPC_SHELL_SET_CONFIG,
  IPC_SYSTEM_GET_LOCALE,
  IPC_SYSTEM_OPEN_EXTERNAL,
  IPC_SYSTEM_OPEN_PATH,
  IPC_PORT_CHECK,
  IPC_WIZARD_TEST_MODEL,
  IPC_WIZARD_COMPLETE_SETUP,
  IPC_SYSTEM_OPEN_LOG_DIR,
  IPC_SHELL_GET_VERSIONS,
  IPC_SHELL_RESIZE_FOR_MAIN_INTERFACE,
  IPC_DIAGNOSTICS_EXPORT,
  IPC_PROVIDERS_LIST,
  IPC_PROVIDERS_SAVE_PROFILE,
  IPC_PROVIDERS_DELETE_PROFILE,
  IPC_PROVIDERS_TEST,
  IPC_PROVIDERS_EXPORT,
  IPC_PROVIDERS_IMPORT,
  IPC_PROVIDERS_SAVE_CONFIG,
  IPC_PROVIDERS_SET_MODEL_DEFAULTS,
  IPC_SKILLS_LIST,
  IPC_SKILLS_TOGGLE,
  IPC_SKILLS_RELOAD,
  IPC_EXTENSIONS_LIST,
  IPC_EXTENSIONS_TOGGLE,
  IPC_REGISTRY_RELOAD,
  IPC_REGISTRY_EXPORT,
  IPC_REGISTRY_IMPORT,
  IPC_REGISTRY_VALIDATE,
  IPC_UPDATE_CHECK,
  IPC_UPDATE_DOWNLOAD_SHELL,
  IPC_UPDATE_INSTALL_SHELL,
  IPC_UPDATE_CANCEL_DOWNLOAD,
  IPC_UPDATE_VERIFY_BUNDLE,
  IPC_UPDATE_PRESTART_CHECK,
  IPC_UPDATE_GET_POST_UPDATE_VALIDATION,
  IPC_DIAGNOSTICS_RUN,
  IPC_DIAGNOSTICS_SUMMARY,
  IPC_MODELS_LIST,
  IPC_MODELS_SET_DEFAULT,
  IPC_MODELS_SET_FALLBACKS,
  IPC_MODELS_SET_ALIASES,
  IPC_PLUGINS_LIST,
  IPC_PLUGINS_TOGGLE,
  IPC_PLUGINS_INSTALL,
  IPC_PLUGINS_UNINSTALL,
  IPC_LOGS_TAIL,
  IPC_BACKUP_CREATE,
  IPC_BACKUP_VERIFY,
} from '../../shared/ipc-channels.js'
import { runPrestartCheck, exportDiagnostics, runDiagnostics, getDiagnosticsSummary } from '../diagnostics/index.js'
import {
  checkForUpdates,
  verifyBundle,
  getPrestartCheckForFrontend,
  downloadUpdate,
  cancelDownload,
  installShellUpdateWithBackup,
  readAndConsumePostUpdateResult,
} from '../update/index.js'
import {
  listAuthProfiles,
  saveAuthProfile,
  saveAuthProfileToken,
  deleteAuthProfile,
  exportAuthProfiles,
  importAuthProfiles,
  getProvidersSummary,
  saveProviderConfig,
  setModelDefaults,
  setModelAliases,
  addProfileToAuthOrder,
  removeProfileFromAuthOrder,
} from '../providers/index.js'
import { listSkillsWithProxy } from '../skills/index.js'
import { listModelsWithProxy } from '../models/index.js'
import {
  listPluginsWithCli,
  togglePlugin,
  installPlugin,
  uninstallPlugin,
} from '../plugins/index.js'
import {
  listExtensions,
  toggleSkill,
  toggleExtension,
  exportRegistry,
  importRegistry,
  validateRegistryItem,
} from '../registry/index.js'
import { tailLogsWithGateway } from '../logs/index.js'
import { getLogAggregator } from '../diagnostics/log-aggregator.js'
import { runBackupCreateCli, runBackupVerifyCli } from '../backup/index.js'
import { syncLoginItemToSystem } from '../login-item/index.js'
import { runConfigValidate } from '../config/index.js'

export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

export interface IpcHandlerDeps {
  gatewayManager: GatewayProcessManager
  readOpenClawConfig: () => OpenClawConfig
  writeOpenClawConfig: (config: OpenClawConfig) => void
  openclawConfigExists: () => boolean
  readShellConfig: () => ShellConfig
  writeShellConfig: (config: ShellConfig) => void
  checkPort: (port: number) => Promise<PortCheckResult>
  getUserDataDir: () => string
  getBundledOpenClawPath?: () => string
  getVersions: () => AppVersionInfo
  resizeMainWindow?: (width: number, height: number, center?: boolean) => void
  /** Resize window for main shell (may grow beyond current size) */
  resizeForMainInterface?: () => void
}

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(code: string, message: string): IpcResult<never> {
  return { success: false, error: { code, message } }
}

type AsyncHandler = (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<IpcResult>

function safelog(method: 'error' | 'warn' | 'info', ...args: unknown[]): void {
  try { console[method](...args) } catch { /* EPIPE — pipe closed, ignore */ }
}

function wrapHandler(code: string, fn: (...args: unknown[]) => Promise<unknown> | unknown): AsyncHandler {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResult> => {
    try {
      const result = await fn(...args)
      return ok(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      safelog('error', `[ipc] ${code} handler error:`, message)
      return fail(code, message)
    }
  }
}

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:'])

function validateExternalUrl(url: unknown): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('URL must be a non-empty string')
  }
  const parsed = new URL(url)
  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Protocol "${parsed.protocol}" is not allowed; only http/https permitted`)
  }
  return url
}

function validatePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a non-null object`)
  }
  return value as Record<string, unknown>
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { gatewayManager } = deps

  ipcMain.handle(
    IPC_GATEWAY_START,
    wrapHandler('GATEWAY_START', () => {
      const config = deps.readOpenClawConfig()
      const gw = config?.gateway
      const port = gw?.port ?? DEFAULT_GATEWAY_PORT
      const bind = gw?.bind ?? 'loopback'
      const token = gw?.auth?.token?.trim()
      const force = Boolean(gw?.forcePortOnConflict)
      return gatewayManager.start({ port, bind, token: token || undefined, force })
    }),
  )

  ipcMain.handle(
    IPC_GATEWAY_STOP,
    wrapHandler('GATEWAY_STOP', () => gatewayManager.stop()),
  )

  ipcMain.handle(
    IPC_GATEWAY_RESTART,
    wrapHandler('GATEWAY_RESTART', () => {
      const config = deps.readOpenClawConfig()
      const gw = config?.gateway
      const port = gw?.port ?? DEFAULT_GATEWAY_PORT
      const bind = gw?.bind ?? 'loopback'
      const token = gw?.auth?.token?.trim()
      const force = Boolean(gw?.forcePortOnConflict)
      return gatewayManager.restart({ port, bind, token: token || undefined, force })
    }),
  )

  ipcMain.handle(
    IPC_GATEWAY_STATUS,
    wrapHandler('GATEWAY_STATUS', () => gatewayManager.getStatus()),
  )

  ipcMain.handle(
    IPC_CONFIG_READ,
    wrapHandler('CONFIG_READ', () => deps.readOpenClawConfig()),
  )

  ipcMain.handle(
    IPC_CONFIG_WRITE,
    wrapHandler('CONFIG_WRITE', (config: unknown) => {
      const validated = validatePlainObject(config, 'config')
      deps.writeOpenClawConfig(validated as OpenClawConfig)
    }),
  )

  ipcMain.handle(
    IPC_CONFIG_EXISTS,
    wrapHandler('CONFIG_EXISTS', () => deps.openclawConfigExists()),
  )

  ipcMain.handle(
    IPC_CONFIG_VALIDATE,
    wrapHandler('CONFIG_VALIDATE', () => runConfigValidate()),
  )

  ipcMain.handle(
    IPC_SHELL_GET_CONFIG,
    wrapHandler('SHELL_GET_CONFIG', () => deps.readShellConfig()),
  )

  ipcMain.handle(
    IPC_SHELL_SET_CONFIG,
    wrapHandler('SHELL_SET_CONFIG', (partial: unknown) => {
      const patch = validatePlainObject(partial, 'shellConfig')
      const current = deps.readShellConfig()
      const merged: ShellConfig = { ...current, ...patch } as ShellConfig
      deps.writeShellConfig(merged)
      if ('autoStart' in patch) {
        syncLoginItemToSystem(merged.autoStart)
      }
    }),
  )

  ipcMain.handle(
    IPC_SYSTEM_GET_LOCALE,
    wrapHandler('SYSTEM_GET_LOCALE', () => {
      return app.getLocale()
    }),
  )

  ipcMain.handle(
    IPC_SYSTEM_OPEN_EXTERNAL,
    wrapHandler('SYSTEM_OPEN_EXTERNAL', (url: unknown) => {
      const validUrl = validateExternalUrl(url)
      return shell.openExternal(validUrl)
    }),
  )

  ipcMain.handle(
    IPC_SYSTEM_OPEN_PATH,
    wrapHandler('SYSTEM_OPEN_PATH', (targetPath: unknown) => {
      if (typeof targetPath !== 'string' || targetPath.length === 0) {
        throw new Error('Path must be a non-empty string')
      }
      return shell.openPath(targetPath)
    }),
  )

  ipcMain.handle(
    IPC_PORT_CHECK,
    wrapHandler('PORT_CHECK', (port: unknown) => {
      if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Port must be an integer between 1 and 65535')
      }
      return deps.checkPort(port)
    }),
  )

  ipcMain.handle(
    IPC_WIZARD_TEST_MODEL,
    wrapHandler('WIZARD_TEST_MODEL', (config: unknown) => {
      const raw = validatePlainObject(config, 'modelConfig')
      const cfg: ModelConfig = {
        provider: raw.provider as ModelConfig['provider'],
        apiKey: String(raw.apiKey ?? ''),
        modelId: String(raw.modelId ?? ''),
        moonshotRegion: raw.moonshotRegion === 'cn' ? 'cn' : raw.moonshotRegion === 'global' ? 'global' : undefined,
        customProviderId: typeof raw.customProviderId === 'string' ? raw.customProviderId : undefined,
        customBaseUrl: typeof raw.customBaseUrl === 'string' ? raw.customBaseUrl : undefined,
        cloudflareAccountId: typeof raw.cloudflareAccountId === 'string' ? raw.cloudflareAccountId : undefined,
        cloudflareGatewayId: typeof raw.cloudflareGatewayId === 'string' ? raw.cloudflareGatewayId : undefined,
        customCompatibility:
          raw.customCompatibility === 'anthropic' ? 'anthropic' : raw.customCompatibility === 'openai' ? 'openai' : undefined,
      }
      if (!cfg.provider || !cfg.apiKey || !cfg.modelId) {
        throw new Error('modelConfig must include provider, apiKey, and modelId')
      }
      if (cfg.provider === 'custom' && (!cfg.customProviderId || !cfg.customBaseUrl)) {
        throw new Error('custom modelConfig must include customProviderId and customBaseUrl')
      }
      return testModelConnection(cfg)
    }),
  )

  ipcMain.handle(
    IPC_WIZARD_COMPLETE_SETUP,
    wrapHandler('WIZARD_COMPLETE_SETUP', async (state: unknown) => {
      const raw = validatePlainObject(state, 'wizardState')
      if (!raw.modelConfig || !raw.gatewayConfig || !raw.channelConfig) {
        throw new Error('wizardState must include modelConfig, gatewayConfig, and channelConfig')
      }
      const ws = raw as unknown as WizardState
      const result = await handleWizardCompleteSetup(ws, {
        writeOpenClawConfig: deps.writeOpenClawConfig,
        readShellConfig: deps.readShellConfig,
        writeShellConfig: deps.writeShellConfig,
        gatewayManager: deps.gatewayManager,
      })
      return result
    }),
  )

  ipcMain.handle(
    IPC_SYSTEM_OPEN_LOG_DIR,
    wrapHandler('SYSTEM_OPEN_LOG_DIR', () => {
      return shell.openPath(deps.getUserDataDir())
    }),
  )

  ipcMain.handle(
    IPC_SHELL_GET_VERSIONS,
    wrapHandler('SHELL_GET_VERSIONS', () => deps.getVersions()),
  )

  ipcMain.handle(
    IPC_SHELL_RESIZE_FOR_MAIN_INTERFACE,
    wrapHandler('SHELL_RESIZE_FOR_MAIN_INTERFACE', () => {
      deps.resizeForMainInterface?.()
    }),
  )

  ipcMain.handle(
    IPC_DIAGNOSTICS_EXPORT,
    wrapHandler('DIAGNOSTICS_EXPORT', async () => {
      const prestartCheck = runPrestartCheck()
      const doctorReport = await runDiagnostics({
        readOpenClawConfig: deps.readOpenClawConfig,
        readShellConfig: deps.readShellConfig,
        gatewayStatus: () => gatewayManager.getStatus(),
      })
      return exportDiagnostics({
        versions: deps.getVersions(),
        openclawConfig: deps.readOpenClawConfig(),
        shellConfig: deps.readShellConfig(),
        prestartCheck,
        doctorReport,
      })
    }),
  )

  ipcMain.handle(
    IPC_DIAGNOSTICS_RUN,
    wrapHandler('DIAGNOSTICS_RUN', async () => {
      return runDiagnostics({
        readOpenClawConfig: deps.readOpenClawConfig,
        readShellConfig: deps.readShellConfig,
        gatewayStatus: () => gatewayManager.getStatus(),
      })
    }),
  )

  ipcMain.handle(
    IPC_DIAGNOSTICS_SUMMARY,
    wrapHandler('DIAGNOSTICS_SUMMARY', async () => {
      const report = await runDiagnostics({
        readOpenClawConfig: deps.readOpenClawConfig,
        readShellConfig: deps.readShellConfig,
        gatewayStatus: () => gatewayManager.getStatus(),
      })
      return getDiagnosticsSummary(report)
    }),
  )

  // ─── Provider / auth profile ───────────────────────────────────────────────
  ipcMain.handle(
    IPC_PROVIDERS_LIST,
    wrapHandler('PROVIDERS_LIST', () => {
      const profiles = listAuthProfiles(true)
      const config = deps.readOpenClawConfig()
      return getProvidersSummary(config, profiles.map((p) => ({
        profileId: p.profileId,
        provider: p.provider,
        hasKey: p.hasKey,
      })))
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_SAVE_PROFILE,
    wrapHandler('PROVIDERS_SAVE_PROFILE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'saveProfile opts')
      const profileId = String(raw.profileId ?? '')
      const provider = String(raw.provider ?? '')
      const credType = raw.type === 'token' ? 'token' : 'api_key'
      if (!profileId || !provider) {
        throw new Error('profileId and provider are required')
      }
      if (credType === 'token') {
        const token = String(raw.token ?? '')
        if (!token) throw new Error('token is required for type: token')
        saveAuthProfileToken(profileId, provider, token)
      } else {
        const apiKey = String(raw.apiKey ?? '')
        if (!apiKey) throw new Error('apiKey is required for type: api_key')
        saveAuthProfile(profileId, provider, apiKey)
      }
      const config = deps.readOpenClawConfig()
      const next = addProfileToAuthOrder(config, provider, profileId)
      deps.writeOpenClawConfig(next)
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_DELETE_PROFILE,
    wrapHandler('PROVIDERS_DELETE_PROFILE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'deleteProfile opts')
      const profileId = String(raw.profileId ?? '')
      if (!profileId) throw new Error('profileId is required')
      const provider = profileId.includes(':') ? profileId.split(':')[0]! : profileId
      deleteAuthProfile(profileId)
      const config = deps.readOpenClawConfig()
      const next = removeProfileFromAuthOrder(config, provider, profileId)
      deps.writeOpenClawConfig(next)
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_TEST,
    wrapHandler('PROVIDERS_TEST', (config: unknown) => {
      const raw = validatePlainObject(config, 'modelConfig')
      const cfg: ModelConfig = {
        provider: raw.provider as ModelConfig['provider'],
        apiKey: String(raw.apiKey ?? ''),
        modelId: String(raw.modelId ?? ''),
        moonshotRegion: raw.moonshotRegion === 'cn' ? 'cn' : raw.moonshotRegion === 'global' ? 'global' : undefined,
        customProviderId: typeof raw.customProviderId === 'string' ? raw.customProviderId : undefined,
        customBaseUrl: typeof raw.customBaseUrl === 'string' ? raw.customBaseUrl : undefined,
        cloudflareAccountId: typeof raw.cloudflareAccountId === 'string' ? raw.cloudflareAccountId : undefined,
        cloudflareGatewayId: typeof raw.cloudflareGatewayId === 'string' ? raw.cloudflareGatewayId : undefined,
        customCompatibility:
          raw.customCompatibility === 'anthropic' ? 'anthropic' : raw.customCompatibility === 'openai' ? 'openai' : undefined,
      }
      if (!cfg.provider || !cfg.apiKey || !cfg.modelId) {
        throw new Error('modelConfig must include provider, apiKey, and modelId')
      }
      if (cfg.provider === 'custom' && (!cfg.customProviderId || !cfg.customBaseUrl)) {
        throw new Error('custom modelConfig must include customProviderId and customBaseUrl')
      }
      return testModelConnection(cfg)
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_EXPORT,
    wrapHandler('PROVIDERS_EXPORT', (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      return exportAuthProfiles({ maskKeys: raw.maskKeys !== false })
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_IMPORT,
    wrapHandler('PROVIDERS_IMPORT', (json: unknown) => {
      if (typeof json !== 'string') throw new Error('json must be a string')
      return importAuthProfiles(json)
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_SAVE_CONFIG,
    wrapHandler('PROVIDERS_SAVE_CONFIG', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'saveProviderConfig opts')
      const providerId = String(raw.providerId ?? '')
      const config = validatePlainObject(raw.config, 'provider config')
      if (!providerId) throw new Error('providerId is required')
      const current = deps.readOpenClawConfig()
      const next = saveProviderConfig(current, providerId, config)
      deps.writeOpenClawConfig(next)
    }),
  )

  ipcMain.handle(
    IPC_PROVIDERS_SET_MODEL_DEFAULTS,
    wrapHandler('PROVIDERS_SET_MODEL_DEFAULTS', (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const primary = typeof raw.primary === 'string' ? raw.primary : undefined
      const fallbacks = Array.isArray(raw.fallbacks)
        ? (raw.fallbacks as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined
      const current = deps.readOpenClawConfig()
      const next = setModelDefaults(current, { primary, fallbacks })
      deps.writeOpenClawConfig(next)
    }),
  )

  // ─── Registry (Skills / Extensions / Commands) ───────────────────────────
  const registryDeps = {
    getBundledOpenClawPath: deps.getBundledOpenClawPath ?? (() => ''),
    getUserDataDir: deps.getUserDataDir,
    readOpenClawConfig: deps.readOpenClawConfig,
    writeOpenClawConfig: deps.writeOpenClawConfig,
  }

  ipcMain.handle(
    IPC_SKILLS_LIST,
    wrapHandler('SKILLS_LIST', (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const source = raw.source === 'bundled' || raw.source === 'user' ? raw.source : undefined
      return listSkillsWithProxy(registryDeps, source)
    }),
  )

  ipcMain.handle(
    IPC_SKILLS_RELOAD,
    wrapHandler('SKILLS_RELOAD', () => ({ ok: true })),
  )

  ipcMain.handle(
    IPC_SKILLS_TOGGLE,
    wrapHandler('SKILLS_TOGGLE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'skills:toggle opts')
      const skillKey = String(raw.skillKey ?? '')
      const enabled = raw.enabled === true
      if (!skillKey) throw new Error('skillKey is required')
      toggleSkill(registryDeps, skillKey, enabled)
      return { ok: true }
    }),
  )

  ipcMain.handle(
    IPC_EXTENSIONS_LIST,
    wrapHandler('EXTENSIONS_LIST', (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const source = raw.source === 'bundled' || raw.source === 'user' ? raw.source : undefined
      return listExtensions(registryDeps, source)
    }),
  )

  ipcMain.handle(
    IPC_EXTENSIONS_TOGGLE,
    wrapHandler('EXTENSIONS_TOGGLE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'extensions:toggle opts')
      const pluginId = String(raw.pluginId ?? '')
      const enabled = raw.enabled === true
      if (!pluginId) throw new Error('pluginId is required')
      toggleExtension(registryDeps, pluginId, enabled)
      return { ok: true }
    }),
  )

  ipcMain.handle(
    IPC_REGISTRY_RELOAD,
    wrapHandler('REGISTRY_RELOAD', () => ({ ok: true })),
  )

  ipcMain.handle(
    IPC_REGISTRY_EXPORT,
    wrapHandler('REGISTRY_EXPORT', (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const skills = Array.isArray(raw.skills) ? (raw.skills as string[]) : undefined
      const extensions = Array.isArray(raw.extensions) ? (raw.extensions as string[]) : undefined
      return exportRegistry(registryDeps, { skills, extensions })
    }),
  )

  ipcMain.handle(
    IPC_REGISTRY_IMPORT,
    wrapHandler('REGISTRY_IMPORT', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'registry:import opts')
      const targetPath = String(raw.path ?? '')
      const merge = raw.merge !== false
      if (!targetPath) throw new Error('path is required')
      return importRegistry(registryDeps, { path: targetPath, merge })
    }),
  )

  ipcMain.handle(
    IPC_REGISTRY_VALIDATE,
    wrapHandler('REGISTRY_VALIDATE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'registry:validate opts')
      const kind = raw.kind === 'skill' ? 'skill' : raw.kind === 'extension' ? 'extension' : null
      const id = String(raw.id ?? '')
      if (!kind || !id) throw new Error('kind and id are required')
      return validateRegistryItem(registryDeps, kind, id)
    }),
  )

  // ─── Models (RPC proxy) ────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_MODELS_LIST,
    wrapHandler('MODELS_LIST', async () => {
      return listModelsWithProxy(deps.readOpenClawConfig)
    }),
  )

  ipcMain.handle(
    IPC_MODELS_SET_DEFAULT,
    wrapHandler('MODELS_SET_DEFAULT', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'models:setDefault opts')
      const primary = String(raw.modelId ?? raw.primary ?? '')
      if (!primary) throw new Error('modelId or primary is required')
      const current = deps.readOpenClawConfig()
      const next = setModelDefaults(current, { primary })
      deps.writeOpenClawConfig(next)
      return { ok: true }
    }),
  )

  ipcMain.handle(
    IPC_MODELS_SET_FALLBACKS,
    wrapHandler('MODELS_SET_FALLBACKS', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'models:setFallbacks opts')
      const fallbacks = Array.isArray(raw.fallbacks)
        ? (raw.fallbacks as unknown[]).filter((x): x is string => typeof x === 'string')
        : []
      const current = deps.readOpenClawConfig()
      const next = setModelDefaults(current, { fallbacks })
      deps.writeOpenClawConfig(next)
      return { ok: true }
    }),
  )

  ipcMain.handle(
    IPC_MODELS_SET_ALIASES,
    wrapHandler('MODELS_SET_ALIASES', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'models:setAliases opts')
      const aliases = raw.aliases
      if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
        throw new Error('aliases must be a record of model id to { alias?: string }')
      }
      const typed: Record<string, { alias?: string }> = {}
      for (const [k, v] of Object.entries(aliases)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          typed[k] = { alias: typeof (v as { alias?: unknown }).alias === 'string' ? (v as { alias: string }).alias : undefined }
        }
      }
      const current = deps.readOpenClawConfig()
      const next = setModelAliases(current, typed)
      deps.writeOpenClawConfig(next)
      return { ok: true }
    }),
  )

  // ─── Plugins (CLI proxy) ───────────────────────────────────────────────────
  ipcMain.handle(
    IPC_PLUGINS_LIST,
    wrapHandler('PLUGINS_LIST', () => listPluginsWithCli()),
  )

  ipcMain.handle(
    IPC_PLUGINS_TOGGLE,
    wrapHandler('PLUGINS_TOGGLE', (opts: unknown) => {
      const raw = validatePlainObject(opts, 'plugins:toggle opts')
      const id = String(raw.id ?? raw.pluginId ?? '')
      const enabled = raw.enabled === true
      if (!id) throw new Error('id or pluginId is required')
      return togglePlugin(id, enabled)
    }),
  )

  ipcMain.handle(
    IPC_PLUGINS_INSTALL,
    wrapHandler('PLUGINS_INSTALL', (spec: unknown) => {
      if (typeof spec !== 'string') throw new Error('spec must be a string')
      return installPlugin(spec)
    }),
  )

  ipcMain.handle(
    IPC_PLUGINS_UNINSTALL,
    wrapHandler('PLUGINS_UNINSTALL', (opts: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const id = String(raw.id ?? raw.pluginId ?? '')
      const keepFiles = raw.keepFiles === true
      if (!id) throw new Error('id or pluginId is required')
      return uninstallPlugin(id, { keepFiles })
    }),
  )

  ipcMain.handle(
    IPC_UPDATE_CHECK,
    wrapHandler('UPDATE_CHECK', () => checkForUpdates(deps.readShellConfig)),
  )

  ipcMain.handle(
    IPC_UPDATE_DOWNLOAD_SHELL,
    wrapHandler('UPDATE_DOWNLOAD_SHELL', () => downloadUpdate()),
  )

  ipcMain.handle(
    IPC_UPDATE_INSTALL_SHELL,
    wrapHandler('UPDATE_INSTALL_SHELL', () => installShellUpdateWithBackup()),
  )

  ipcMain.handle(
    IPC_UPDATE_CANCEL_DOWNLOAD,
    wrapHandler('UPDATE_CANCEL_DOWNLOAD', () => {
      cancelDownload()
      return {}
    }),
  )

  ipcMain.handle(
    IPC_UPDATE_VERIFY_BUNDLE,
    wrapHandler('UPDATE_VERIFY_BUNDLE', () => verifyBundle()),
  )

  ipcMain.handle(
    IPC_UPDATE_PRESTART_CHECK,
    wrapHandler('UPDATE_PRESTART_CHECK', () => getPrestartCheckForFrontend()),
  )

  ipcMain.handle(
    IPC_UPDATE_GET_POST_UPDATE_VALIDATION,
    wrapHandler('UPDATE_GET_POST_UPDATE_VALIDATION', () => {
      const result = readAndConsumePostUpdateResult()
      return result ?? { ran: false, ok: true, rollbackGuidance: '' }
    }),
  )

  // ─── Backup (CLI proxy) ────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_BACKUP_CREATE,
    wrapHandler('BACKUP_CREATE', async (opts?: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const params = {
        output: typeof raw.output === 'string' ? raw.output : undefined,
        includeWorkspace: raw.includeWorkspace === false ? false : undefined,
        onlyConfig: raw.onlyConfig === true ? true : undefined,
        verify: raw.verify === true ? true : undefined,
      }
      return runBackupCreateCli(params)
    }),
  )

  ipcMain.handle(
    IPC_BACKUP_VERIFY,
    wrapHandler('BACKUP_VERIFY', (archivePath: unknown) => {
      if (typeof archivePath !== 'string' || archivePath.trim().length === 0) {
        throw new Error('archivePath must be a non-empty string')
      }
      return runBackupVerifyCli(archivePath.trim())
    }),
  )

  // ─── Logs (RPC proxy) ──────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_LOGS_TAIL,
    wrapHandler('LOGS_TAIL', async (opts: unknown) => {
      const raw = opts && typeof opts === 'object' && !Array.isArray(opts)
        ? (opts as Record<string, unknown>)
        : {}
      const params = {
        cursor: typeof raw.cursor === 'number' ? raw.cursor : undefined,
        limit: typeof raw.limit === 'number' ? raw.limit : undefined,
        maxBytes: typeof raw.maxBytes === 'number' ? raw.maxBytes : undefined,
      }
      try {
        return await tailLogsWithGateway(params)
      } catch {
        const aggregator = getLogAggregator()
        const recent = aggregator.getRecent(500).filter((e) => e.source === 'gateway')
        return {
          lines: recent.map((e) => `[${e.timestamp}] [${e.level}] ${e.message}`),
          truncated: false,
          reset: false,
        }
      }
    }),
  )
}

export function removeIpcHandlers(): void {
  ipcMain.removeHandler(IPC_GATEWAY_START)
  ipcMain.removeHandler(IPC_GATEWAY_STOP)
  ipcMain.removeHandler(IPC_GATEWAY_RESTART)
  ipcMain.removeHandler(IPC_GATEWAY_STATUS)
  ipcMain.removeHandler(IPC_CONFIG_READ)
  ipcMain.removeHandler(IPC_CONFIG_WRITE)
  ipcMain.removeHandler(IPC_CONFIG_EXISTS)
  ipcMain.removeHandler(IPC_CONFIG_VALIDATE)
  ipcMain.removeHandler(IPC_SHELL_GET_CONFIG)
  ipcMain.removeHandler(IPC_SHELL_SET_CONFIG)
  ipcMain.removeHandler(IPC_SYSTEM_GET_LOCALE)
  ipcMain.removeHandler(IPC_SYSTEM_OPEN_EXTERNAL)
  ipcMain.removeHandler(IPC_SYSTEM_OPEN_PATH)
  ipcMain.removeHandler(IPC_PORT_CHECK)
  ipcMain.removeHandler(IPC_WIZARD_TEST_MODEL)
  ipcMain.removeHandler(IPC_WIZARD_COMPLETE_SETUP)
  ipcMain.removeHandler(IPC_SYSTEM_OPEN_LOG_DIR)
  ipcMain.removeHandler(IPC_SHELL_GET_VERSIONS)
  ipcMain.removeHandler(IPC_SHELL_RESIZE_FOR_MAIN_INTERFACE)
  ipcMain.removeHandler(IPC_DIAGNOSTICS_EXPORT)
  ipcMain.removeHandler(IPC_DIAGNOSTICS_RUN)
  ipcMain.removeHandler(IPC_DIAGNOSTICS_SUMMARY)
  ipcMain.removeHandler(IPC_PROVIDERS_LIST)
  ipcMain.removeHandler(IPC_PROVIDERS_SAVE_PROFILE)
  ipcMain.removeHandler(IPC_PROVIDERS_DELETE_PROFILE)
  ipcMain.removeHandler(IPC_PROVIDERS_TEST)
  ipcMain.removeHandler(IPC_PROVIDERS_EXPORT)
  ipcMain.removeHandler(IPC_PROVIDERS_IMPORT)
  ipcMain.removeHandler(IPC_PROVIDERS_SAVE_CONFIG)
  ipcMain.removeHandler(IPC_PROVIDERS_SET_MODEL_DEFAULTS)
  ipcMain.removeHandler(IPC_SKILLS_LIST)
  ipcMain.removeHandler(IPC_SKILLS_TOGGLE)
  ipcMain.removeHandler(IPC_SKILLS_RELOAD)
  ipcMain.removeHandler(IPC_EXTENSIONS_LIST)
  ipcMain.removeHandler(IPC_EXTENSIONS_TOGGLE)
  ipcMain.removeHandler(IPC_REGISTRY_RELOAD)
  ipcMain.removeHandler(IPC_REGISTRY_EXPORT)
  ipcMain.removeHandler(IPC_REGISTRY_IMPORT)
  ipcMain.removeHandler(IPC_REGISTRY_VALIDATE)
  ipcMain.removeHandler(IPC_MODELS_LIST)
  ipcMain.removeHandler(IPC_MODELS_SET_DEFAULT)
  ipcMain.removeHandler(IPC_MODELS_SET_FALLBACKS)
  ipcMain.removeHandler(IPC_MODELS_SET_ALIASES)
  ipcMain.removeHandler(IPC_PLUGINS_LIST)
  ipcMain.removeHandler(IPC_PLUGINS_TOGGLE)
  ipcMain.removeHandler(IPC_PLUGINS_INSTALL)
  ipcMain.removeHandler(IPC_PLUGINS_UNINSTALL)
  ipcMain.removeHandler(IPC_LOGS_TAIL)
  ipcMain.removeHandler(IPC_BACKUP_CREATE)
  ipcMain.removeHandler(IPC_BACKUP_VERIFY)
  ipcMain.removeHandler(IPC_UPDATE_CHECK)
  ipcMain.removeHandler(IPC_UPDATE_DOWNLOAD_SHELL)
  ipcMain.removeHandler(IPC_UPDATE_INSTALL_SHELL)
  ipcMain.removeHandler(IPC_UPDATE_CANCEL_DOWNLOAD)
  ipcMain.removeHandler(IPC_UPDATE_VERIFY_BUNDLE)
  ipcMain.removeHandler(IPC_UPDATE_PRESTART_CHECK)
  ipcMain.removeHandler(IPC_UPDATE_GET_POST_UPDATE_VALIDATION)
}
