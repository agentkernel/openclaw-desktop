/**
 * ElectronAPI 类型定义 — Renderer 通过 window.electronAPI 调用
 * 与 Preload 暴露的 API 签名一致
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
} from './types'

/** 端口检测结果 */
export interface PortCheckResult {
  available: boolean
  pid?: number
}

/** Gateway 启动/重启结果 */
export interface GatewayStartResult {
  port: number
}

/** 模型测试结果 */
export interface WizardTestModelResult {
  ok: boolean
  message?: string
}

/** Gateway 日志输出 */
export interface GatewayLogPayload {
  level: string
  message: string
}

/** 结构化日志（stream:gateway-logs） */
export interface StructuredLogPayload {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  source: 'shell' | 'gateway' | 'install-validation'
  message: string
}

/** 备份创建结果 */
export interface BackupCreateResult {
  archivePath: string
  assets: Array<{ kind: string; displayPath: string }>
  skipped?: Array<{ kind: string; displayPath: string; reason: string }>
  verified?: boolean
}

/** 配置校验结果（openclaw config validate --json） */
export interface ConfigValidationResult {
  valid: boolean
  configPath: string
  issues: Array<{ path: string; message: string; allowedValues?: string[] }>
}

/** 备份校验结果 */
export interface BackupVerifyResult {
  ok: boolean
  archivePath?: string
  message?: string
}

/** logs.tail 响应 */
export interface LogsTailResult {
  file?: string
  cursor?: number
  size?: number
  lines?: string[]
  truncated?: boolean
  reset?: boolean
}

/** 更新可用 */
export interface UpdateAvailablePayload {
  version: string
}

/** 更新进度 */
export interface UpdateProgressPayload {
  percent: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  completed?: boolean
  error?: string
}

/** Provider 管理列表结果 */
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

/** 取消订阅函数 */
export type Unsubscribe = () => void

/** Preload 暴露的 electronAPI 接口 */
export interface ElectronAPI {
  // ─── 请求-响应通道 ───────────────────────────────────────────────────────
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

  // ─── 事件订阅通道 ───────────────────────────────────────────────────────
  onGatewayStatusChange: (callback: (status: GatewayStatus) => void) => Unsubscribe
  onGatewayLog: (callback: (log: GatewayLogPayload) => void) => Unsubscribe
  onStreamGatewayLogs: (callback: (log: StructuredLogPayload) => void) => Unsubscribe
  onUpdateAvailable: (callback: (info: UpdateAvailablePayload) => void) => Unsubscribe
  onUpdateProgress: (callback: (progress: UpdateProgressPayload) => void) => Unsubscribe
}
