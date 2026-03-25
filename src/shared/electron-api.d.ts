/**
 * `window.electronAPI` typings — must match preload exposure.
 */

import type {
  GatewayStatus,
  ShellConfig,
  OpenClawConfig,
  ModelConfig,
  ModelProviderConfig,
  WizardState,
  WizardCompleteResult,
  AppVersionInfo,
  SkillRegistryItem,
  ExtensionRegistryItem,
  PluginInfo,
  ValidationResult,
  RegistryExportSummary,
  UpdateCheckResult,
  BundleVerifyResult,
  PrestartCheckFrontend,
  PostUpdateValidationResult,
  DiagnosticReport,
  DiagnosticItem,
  PairingApproveResult,
  PairingListApprovedResult,
  PairingListPendingResult,
} from './types'

/** TCP port check result */
export interface PortCheckResult {
  available: boolean
  pid?: number
}

/** Gateway start/restart result */
export interface GatewayStartResult {
  port: number
}

/** Wizard / provider model test result */
export interface WizardTestModelResult {
  ok: boolean
  message?: string
}

/** Gateway log line */
export interface GatewayLogPayload {
  level: string
  message: string
}

/** Structured gateway log (`stream:gateway-logs`) */
export interface StructuredLogPayload {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  source: 'shell' | 'gateway' | 'install-validation'
  message: string
}

/** Backup archive create result */
export interface BackupCreateResult {
  archivePath: string
  assets: Array<{ kind: string; displayPath: string }>
  skipped?: Array<{ kind: string; displayPath: string; reason: string }>
  verified?: boolean
}

/** `openclaw config validate --json` result */
export interface ConfigValidationResult {
  valid: boolean
  configPath: string
  issues: Array<{ path: string; message: string; allowedValues?: string[] }>
}

/** Backup verify result */
export interface BackupVerifyResult {
  ok: boolean
  archivePath?: string
  message?: string
}

/** `logs.tail` RPC response */
export interface LogsTailResult {
  file?: string
  cursor?: number
  size?: number
  lines?: string[]
  truncated?: boolean
  reset?: boolean
}

/** Update-available push payload */
export interface UpdateAvailablePayload {
  version: string
}

/** Update download progress */
export interface UpdateProgressPayload {
  percent: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  completed?: boolean
  error?: string
}

/** LLM providers + profiles list */
export interface ProvidersListResult {
  profiles: Array<{ profileId: string; provider: string; hasKey: boolean }>
  providers: Array<{
    providerId: string
    baseUrl?: string
    api?: string
    hasApiKey: boolean
    models?: Array<{ id: string; name?: string }>
  }>
  modelDefaults: { primary?: string; fallbacks?: string[] }
  authOrder: Record<string, string[]>
}

/** IPC event unsubscribe handle */
export type Unsubscribe = () => void

/** Preload `electronAPI` surface */
export interface ElectronAPI {
  // ─── Invoke channels ───────────────────────────────────────────────────────
  gatewayStart: () => Promise<GatewayStartResult>
  gatewayStop: () => Promise<void>
  gatewayRestart: () => Promise<GatewayStartResult>
  gatewayStatus: () => Promise<GatewayStatus>
  configRead: () => Promise<OpenClawConfig>
  configWrite: (config: OpenClawConfig) => Promise<void>
  configExists: () => Promise<boolean>
  configValidate: () => Promise<ConfigValidationResult>
  shellGetConfig: () => Promise<ShellConfig>
  shellSetConfig: (config: Partial<ShellConfig>) => Promise<void>
  systemGetLocale: () => Promise<string>
  systemOpenExternal: (url: string) => Promise<void>
  systemOpenPath: (path: string) => Promise<void>
  systemOpenLogDir: () => Promise<void>
  portCheck: (port: number) => Promise<PortCheckResult>
  wizardTestModel: (config: ModelConfig) => Promise<WizardTestModelResult>
  wizardCompleteSetup: (state: WizardState) => Promise<WizardCompleteResult>
  shellGetVersions: () => Promise<AppVersionInfo>
  shellResizeForMainInterface: () => Promise<void>
  shellSetWindowTitle: (title: string) => Promise<void>
  diagnosticsExport: () => Promise<{ path: string; checksum: string }>

  providersList: () => Promise<ProvidersListResult>
  providersSaveProfile: (opts: { profileId: string; provider: string; apiKey: string }) => Promise<void>
  providersDeleteProfile: (opts: { profileId: string }) => Promise<void>
  providersTest: (config: ModelConfig) => Promise<WizardTestModelResult>
  providersExport: (opts?: { maskKeys?: boolean }) => Promise<string>
  providersImport: (json: string) => Promise<{ imported: number; errors: string[] }>
  providersSaveProviderConfig: (opts: { providerId: string; config: Partial<ModelProviderConfig> }) => Promise<void>
  providersSetModelDefaults: (opts: { primary?: string; fallbacks?: string[] }) => Promise<void>

  skillsList: (opts?: { source?: 'all' | 'bundled' | 'user' }) => Promise<SkillRegistryItem[]>
  skillsToggle: (opts: { skillKey: string; enabled: boolean }) => Promise<{ ok: boolean }>
  skillsReload: () => Promise<{ ok: boolean }>
  extensionsList: (opts?: { source?: 'all' | 'bundled' | 'user' }) => Promise<ExtensionRegistryItem[]>
  extensionsToggle: (opts: { pluginId: string; enabled: boolean }) => Promise<{ ok: boolean }>
  registryReload: () => Promise<{ ok: boolean }>
  registryExport: (opts?: { skills?: string[]; extensions?: string[] }) => Promise<{ path: string; summary: RegistryExportSummary; checksum: string }>
  registryImport: (opts: { path: string; merge?: boolean }) => Promise<{ ok: boolean; merged: string[]; errors: string[] }>
  registryValidate: (opts: { kind: 'skill' | 'extension'; id: string }) => Promise<ValidationResult>

  updateCheck: () => Promise<UpdateCheckResult>
  updateDownloadShell: () => Promise<void>
  updateInstallShell: () => Promise<void>
  updateCancelDownload: () => Promise<void>
  updateVerifyBundle: () => Promise<BundleVerifyResult>
  updatePrestartCheck: () => Promise<PrestartCheckFrontend>
  updateGetPostUpdateValidation: () => Promise<PostUpdateValidationResult>
  diagnosticsRun: () => Promise<DiagnosticReport>
  diagnosticsSummary: () => Promise<{ ok: boolean; summary: string; topIssues: DiagnosticItem[] }>

  modelsList: () => Promise<{ models: Array<{ id: string; name?: string; provider?: string }> }>
  modelsSetDefault: (opts: { modelId: string } | { primary: string }) => Promise<{ ok: boolean }>
  modelsSetFallbacks: (opts: { fallbacks: string[] }) => Promise<{ ok: boolean }>
  modelsSetAliases: (opts: { aliases: Record<string, { alias?: string }> }) => Promise<{ ok: boolean }>

  pluginsList: () => Promise<{ plugins: PluginInfo[]; workspaceDir?: string }>
  pluginsToggle: (opts: { id: string; enabled: boolean } | { pluginId: string; enabled: boolean }) => Promise<{ ok: boolean; message?: string }>
  pluginsInstall: (spec: string) => Promise<{ ok: boolean; pluginId?: string; message?: string }>
  pluginsUninstall: (opts: { id: string; keepFiles?: boolean } | { pluginId: string; keepFiles?: boolean }) => Promise<{ ok: boolean; message?: string }>

  logsTail: (opts?: { cursor?: number; limit?: number; maxBytes?: number }) => Promise<LogsTailResult>

  backupCreate: (opts?: { output?: string; includeWorkspace?: boolean; onlyConfig?: boolean; verify?: boolean }) => Promise<BackupCreateResult>
  backupVerify: (archivePath: string) => Promise<BackupVerifyResult>

  pairingListPending: (opts: { channel: 'feishu' }) => Promise<PairingListPendingResult>
  pairingListApproved: (opts: { channel: 'feishu' }) => Promise<PairingListApprovedResult>
  pairingApprove: (opts: { channel: 'feishu'; code: string; openId?: string }) => Promise<PairingApproveResult>
  pairingRemoveApproved: (opts: { channel: 'feishu'; openId: string }) => Promise<{ ok: boolean }>

  // ─── Event subscriptions ───────────────────────────────────────────────────
  onGatewayStatusChange: (callback: (status: GatewayStatus) => void) => Unsubscribe
  onGatewayLog: (callback: (log: GatewayLogPayload) => void) => Unsubscribe
  onStreamGatewayLogs: (callback: (log: StructuredLogPayload) => void) => Unsubscribe
  onUpdateAvailable: (callback: (info: UpdateAvailablePayload) => void) => Unsubscribe
  onUpdateProgress: (callback: (progress: UpdateProgressPayload) => void) => Unsubscribe
}
