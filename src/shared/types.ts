/**
 * 共享类型定义 — Main 与 Renderer 共用
 * 与 OpenClaw 官方配置格式兼容
 */

// ─── ShellConfig ─────────────────────────────────────────────────────────────

/** 窗口位置和大小 */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

/** 外壳主题 */
export type ShellTheme = 'system' | 'light' | 'dark'

/** 更新通道 */
export type UpdateChannel = 'stable' | 'beta'

/** 桌面外壳自身配置，存储在 %APPDATA%\OpenClaw Desktop\config.json */
export interface ShellConfig {
  closeToTray: boolean
  autoStart: boolean
  theme: ShellTheme
  lastGatewayPort: number
  updateChannel: UpdateChannel
  /** 是否自动检查更新，默认 true */
  autoCheckUpdates?: boolean
  /** 上次检查更新时间（ISO 8601） */
  lastUpdateCheck?: string
  windowBounds: WindowBounds
}

// ─── OpenClawConfig ───────────────────────────────────────────────────────────

/** Gateway 认证配置 */
export interface GatewayAuthConfig {
  mode?: 'token' | 'password' | 'none'
  token?: string
}

/** Gateway 配置 */
export interface GatewayConfig {
  /** 与原生 doctor 期望一致：local（桌面壳）或 remote */
  mode?: 'local' | 'remote'
  port?: number
  bind?: 'loopback' | 'lan' | 'auto'
  auth?: GatewayAuthConfig
  /** 端口冲突时是否自动传递 --force（与原生 gateway run 对齐） */
  forcePortOnConflict?: boolean
}

/** Auth 配置中的 profile 选择项（与原生 OpenClaw 对齐） */
export interface AuthProfileSelection {
  provider: string
  mode: 'api_key' | 'oauth' | 'token'
  email?: string
}

/** Auth 配置（与原生 OpenClaw 对齐） */
export interface AuthConfig {
  profiles?: Record<string, AuthProfileSelection>
  order?: Record<string, string[]>
}

/** 默认模型配置 */
export interface AgentModelDefaults {
  primary?: string
  /** 降级模型链（provider/model 格式） */
  fallbacks?: string[]
}

/** 默认模型别名配置 */
export interface AgentModelAlias {
  alias?: string
}

/** Agent 默认配置 */
export interface AgentDefaultsConfig {
  /** CLI 兼容：允许 model 为字符串（provider/model） */
  model?: AgentModelDefaults | string
  /** 可选：模型别名映射（例如 moonshot/kimi-k2.5） */
  models?: Record<string, AgentModelAlias>
  workspace?: string
}

/** Agents 配置 */
export interface AgentsConfig {
  defaults?: AgentDefaultsConfig
}

/** 飞书通道配置 */
export interface FeishuChannelConfig {
  appId?: string
  appSecret?: string
  verificationToken?: string
  encryptKey?: string
}

/** 向导用 Telegram 配置（与原生 TelegramConfig 对齐） */
export interface TelegramChannelConfig {
  botToken?: string
}

/** 向导用 Discord 配置（与原生 DiscordConfig 对齐） */
export interface DiscordChannelConfig {
  token?: string
}

/** 向导用 Slack 配置（与原生 SlackConfig 对齐） */
export interface SlackChannelConfig {
  mode?: 'socket' | 'http'
  botToken?: string
  signingSecret?: string
  appToken?: string
}

/** 向导用 WhatsApp 配置（与原生 WhatsAppConfig 对齐，Baileys 需 Control UI 配置） */
export interface WhatsAppChannelConfig {
  enabled?: boolean
}

/** 通道配置（按通道名索引） */
export interface ChannelsConfig {
  feishu?: FeishuChannelConfig
  telegram?: TelegramChannelConfig
  discord?: DiscordChannelConfig
  slack?: SlackChannelConfig
  whatsapp?: WhatsAppChannelConfig
  [key: string]: unknown
}

/** OpenClaw 主配置，存储在 %USERPROFILE%\.openclaw\openclaw.json */
export interface OpenClawConfig {
  gateway?: GatewayConfig
  agents?: AgentsConfig
  channels?: ChannelsConfig
  auth?: AuthConfig
  models?: ModelsConfig
  [key: string]: unknown
}

/** 自定义/扩展模型 Provider 配置 */
export interface ModelProviderConfig {
  baseUrl?: string
  compatibility?: 'openai' | 'anthropic'
  /** OpenClaw 原生字段：模型 API 类型 */
  api?: string
  apiKey?: string
  /** 自定义 HTTP 头 */
  headers?: Record<string, string>
  /** 是否发送 Authorization 头（copilot-proxy 等本地代理为 false） */
  authHeader?: boolean
  models?: Array<Record<string, unknown> & { id: string; name?: string }>
}

/** Models 配置（与 CLI 结构对齐） */
export interface ModelsConfig {
  mode?: 'merge' | 'replace'
  providers?: Record<string, ModelProviderConfig>
}

// ─── WizardState ─────────────────────────────────────────────────────────────

/** 模型提供商 */
export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'openai-codex'
  | 'google'
  | 'openrouter'
  | 'opencode'
  | 'mistral'
  | 'minimax'
  | 'moonshot'
  | 'moonshot-cn' // UI alias: moonshot with China endpoint (api.moonshot.cn)
  | 'zai'
  | 'venice'
  | 'groq'
  | 'xai'
  | 'cerebras'
  | 'huggingface'
  | 'github-copilot'
  | 'kilocode'
  | 'volcengine'
  | 'volcengine-plan'
  | 'byteplus'
  | 'byteplus-plan'
  | 'qianfan'
  | 'bedrock'
  | 'cloudflare-ai-gateway'
  | 'litellm'
  | 'together'
  | 'nvidia'
  | 'qwen-portal'
  | 'google-vertex'
  | 'google-antigravity'
  | 'google-gemini-cli'
  | 'ollama'
  | 'vllm'
  | 'lmstudio'
  | 'vercel-ai-gateway'
  | 'synthetic'
  | 'xiaomi'
  | 'kimi-coding'
  | 'chutes'
  | 'copilot-proxy'
  | 'custom'

/** 向导中的模型配置 */
export interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  modelId: string
  /** Moonshot endpoint region */
  moonshotRegion?: 'global' | 'cn'
  /** 自定义 Provider: 真实 provider id */
  customProviderId?: string
  /** 自定义 Provider: API Base URL */
  customBaseUrl?: string
  /** 自定义 Provider: 兼容协议 */
  customCompatibility?: 'openai' | 'anthropic'
}

/** 向导中的通道配置 */
export interface ChannelConfig {
  feishu: FeishuChannelConfig | null
  telegram: TelegramChannelConfig | null
  discord: DiscordChannelConfig | null
  slack: SlackChannelConfig | null
  whatsapp: WhatsAppChannelConfig | null
  selectedChannel: 'feishu' | 'telegram' | 'whatsapp' | 'discord' | 'slack'
  skipChannels: boolean
}

/** 向导中的 Gateway 配置 */
export interface GatewayWizardConfig {
  port: number
  bind: 'loopback' | 'lan' | 'auto'
  authToken: string
}

/** 向导进度状态（内存态），由 Zustand store 管理 */
export interface WizardState {
  currentStep: number
  modelConfig: ModelConfig
  channelConfig: ChannelConfig
  gatewayConfig: GatewayWizardConfig
}

// ─── WizardCompleteResult ─────────────────────────────────────────────────────

/** 向导 completeSetup 结果 */
export interface WizardCompleteResult {
  ok: boolean
  port?: number
  error?: string
  phase?: 'config' | 'auth' | 'gateway'
}

// ─── BundleManifest / AppVersionInfo ────────────────────────────────────────

/** Bundle manifest（prepare-bundle 写入，供 About/Update Center 展示） */
export interface BundleManifest {
  shellVersion: string
  bundledOpenClawVersion: string
}

/** 应用版本信息，由主进程收集 */
export interface AppVersionInfo {
  shell: string
  electron: string
  node: string
  openclaw: string
}

// ─── GatewayStatus ───────────────────────────────────────────────────────────

/** Gateway 状态枚举 */
export type GatewayStatusValue = 'starting' | 'running' | 'stopped' | 'error'

/** Gateway 子进程运行状态 */
export interface GatewayStatus {
  running: boolean
  port: number
  pid: number | null
  uptime: number
  status: GatewayStatusValue
}

// ─── Registry (Skills / Extensions / Commands) ──────────────────────────────

/** Skill 来源 */
export type SkillSource = 'bundled' | 'user-workspace' | 'user-extensions' | 'load-path'

/** Extension 来源 */
export type ExtensionSource = 'bundled' | 'user-extensions' | 'load-path'

/** Skill 注册表项 */
export interface SkillRegistryItem {
  id: string
  name: string
  description?: string
  source: SkillSource
  enabled: boolean
  path: string
  version?: string
  requires?: { bins?: string[]; env?: string[]; config?: string[] }
  conflict?: string
}

/** Extension 注册表项 */
export interface ExtensionRegistryItem {
  id: string
  name: string
  description?: string
  source: ExtensionSource
  enabled: boolean
  path: string
  version?: string
  providers?: string[]
  tools?: string[]
  commands?: string[]
  error?: string
}

/** 插件信息（来自 openclaw plugins list --json） */
export interface PluginInfo {
  id: string
  name?: string
  status: 'loaded' | 'disabled' | 'error'
  description?: string
  source?: string
  origin?: string
  version?: string
  error?: string
}

/** 校验结果 */
export interface ValidationResult {
  ok: boolean
  errors?: string[]
  warnings?: string[]
}

/** 导出摘要 */
export interface RegistryExportSummary {
  skills: string[]
  extensions: string[]
  exportedAt: string
}

// ─── Update / Verify / Repair ────────────────────────────────────────────────

/** GitHub Release 版本信息 */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  publishedAt?: string
  downloadUrl?: string
  error?: string
}

/** Bundle 校验结果 */
export interface BundleVerifyResult {
  ok: boolean
  nodeExists: boolean
  openclawExists: boolean
  missing: string[]
  versions: {
    shell: string
    electron: string
    node: string
    openclaw: string
  }
}

/** 预启动检查结果（前端可消费） */
export interface PrestartCheckFrontend {
  ok: boolean
  bundleOk: boolean
  configExists: boolean
  configParseable: boolean
  errors: string[]
  fixSuggestions: string[]
}

/** 安装后校验结果（供 Update Center 展示回滚指引） */
export interface PostUpdateValidationResult {
  ran: boolean
  ok: boolean
  report?: DiagnosticReport
  rollbackGuidance: string
}

// ─── Diagnostics (Doctor 代理) ────────────────────────────────────────────────

/** 诊断项级别 */
export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'pass'

/** 诊断项 */
export interface DiagnosticItem {
  id: string
  level: DiagnosticLevel
  message: string
  fix?: string
  source?: 'cli' | 'prestart' | 'desktop'
}

/** 诊断报告 */
export interface DiagnosticReport {
  ok: boolean
  items: DiagnosticItem[]
  runAt: string
}
