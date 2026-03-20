/**
 * Shared types — used by main and renderer processes.
 * Compatible with upstream OpenClaw configuration shape.
 */

// ─── ShellConfig ─────────────────────────────────────────────────────────────

/** Window position and size */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

/** Desktop shell theme */
export type ShellTheme = 'system' | 'light' | 'dark'

/** Update channel */
export type UpdateChannel = 'stable' | 'beta'

/** Desktop shell settings stored in %APPDATA%\OpenClaw Desktop\config.json */
export interface ShellConfig {
  closeToTray: boolean
  autoStart: boolean
  theme: ShellTheme
  lastGatewayPort: number
  updateChannel: UpdateChannel
  /** After first-run wizard: whether main-window expand ran once */
  onboardingMainWindowExpanded?: boolean
  /** Whether to check for updates automatically; default true */
  autoCheckUpdates?: boolean
  /** Last update check time (ISO 8601) */
  lastUpdateCheck?: string
  windowBounds: WindowBounds
}

// ─── OpenClawConfig ───────────────────────────────────────────────────────────

/** Gateway authentication config */
export interface GatewayAuthConfig {
  mode?: 'token' | 'password' | 'none'
  token?: string
}

/** Gateway config */
export interface GatewayConfig {
  /** Matches upstream doctor: local (desktop shell) or remote */
  mode?: 'local' | 'remote'
  port?: number
  bind?: 'loopback' | 'lan' | 'auto'
  auth?: GatewayAuthConfig
  /** When true, pass --force on port conflict (aligned with gateway run) */
  forcePortOnConflict?: boolean
}

/** Auth profile selection entry (aligned with upstream OpenClaw) */
export interface AuthProfileSelection {
  provider: string
  mode: 'api_key' | 'oauth' | 'token'
  email?: string
}

/** Auth config (aligned with upstream OpenClaw) */
export interface AuthConfig {
  profiles?: Record<string, AuthProfileSelection>
  order?: Record<string, string[]>
}

/** Default model settings */
export interface AgentModelDefaults {
  primary?: string
  /** Fallback model chain (provider/model) */
  fallbacks?: string[]
}

/** Default model alias entry */
export interface AgentModelAlias {
  alias?: string
}

/** Agent defaults */
export interface AgentDefaultsConfig {
  /** CLI compatibility: model may be a string (provider/model) */
  model?: AgentModelDefaults | string
  /** Optional model alias map (e.g. moonshot/kimi-k2.5) */
  models?: Record<string, AgentModelAlias>
  workspace?: string
}

/** Agents section */
export interface AgentsConfig {
  defaults?: AgentDefaultsConfig
}

/** Feishu (Lark) channel config */
export interface FeishuChannelConfig {
  appId?: string
  appSecret?: string
  verificationToken?: string
  encryptKey?: string
}

/** Wizard Telegram channel (aligned with upstream TelegramConfig) */
export interface TelegramChannelConfig {
  botToken?: string
}

/** Wizard Discord channel (aligned with upstream DiscordConfig) */
export interface DiscordChannelConfig {
  token?: string
}

/** Wizard Slack channel (aligned with upstream SlackConfig) */
export interface SlackChannelConfig {
  mode?: 'socket' | 'http'
  botToken?: string
  signingSecret?: string
  appToken?: string
}

/** Wizard WhatsApp channel (aligned with upstream; Baileys needs Control UI) */
export interface WhatsAppChannelConfig {
  enabled?: boolean
}

/** Channels keyed by channel name */
export interface ChannelsConfig {
  feishu?: FeishuChannelConfig
  telegram?: TelegramChannelConfig
  discord?: DiscordChannelConfig
  slack?: SlackChannelConfig
  whatsapp?: WhatsAppChannelConfig
  [key: string]: unknown
}

/** Main OpenClaw config at %USERPROFILE%\.openclaw\openclaw.json */
export interface OpenClawConfig {
  gateway?: GatewayConfig
  agents?: AgentsConfig
  channels?: ChannelsConfig
  auth?: AuthConfig
  models?: ModelsConfig
  [key: string]: unknown
}

/** Custom / extended model provider entry */
export interface ModelProviderConfig {
  baseUrl?: string
  compatibility?: 'openai' | 'anthropic'
  /** Upstream field: model API kind */
  api?: string
  apiKey?: string
  /** Custom HTTP headers */
  headers?: Record<string, string>
  /** Whether to send Authorization (false for local proxies like copilot-proxy) */
  authHeader?: boolean
  models?: Array<Record<string, unknown> & { id: string; name?: string }>
}

/** Models section (CLI-aligned) */
export interface ModelsConfig {
  mode?: 'merge' | 'replace'
  providers?: Record<string, ModelProviderConfig>
}

// ─── WizardState ─────────────────────────────────────────────────────────────

/** Model provider id */
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
  | 'kuae' // Kuae Cloud Coding Plan
  | 'custom'

/** Wizard model step data */
export interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  modelId: string
  /** Moonshot endpoint region */
  moonshotRegion?: 'global' | 'cn'
  /** Custom provider: real provider id */
  customProviderId?: string
  /** Custom provider: API base URL */
  customBaseUrl?: string
  /** Custom provider: protocol compatibility */
  customCompatibility?: 'openai' | 'anthropic'
  /** Cloudflare AI Gateway: Account ID */
  cloudflareAccountId?: string
  /** Cloudflare AI Gateway: Gateway ID */
  cloudflareGatewayId?: string
}

/** Wizard channel step data */
export interface ChannelConfig {
  feishu: FeishuChannelConfig | null
  telegram: TelegramChannelConfig | null
  discord: DiscordChannelConfig | null
  slack: SlackChannelConfig | null
  whatsapp: WhatsAppChannelConfig | null
  selectedChannel: 'feishu' | 'telegram' | 'whatsapp' | 'discord' | 'slack'
  skipChannels: boolean
}

/** Wizard gateway step data */
export interface GatewayWizardConfig {
  port: number
  bind: 'loopback' | 'lan' | 'auto'
  authToken: string
}

/** Wizard progress (in-memory, Zustand) */
export interface WizardState {
  currentStep: number
  modelConfig: ModelConfig
  channelConfig: ChannelConfig
  gatewayConfig: GatewayWizardConfig
}

// ─── WizardCompleteResult ─────────────────────────────────────────────────────

/** Result of wizard completeSetup */
export interface WizardCompleteResult {
  ok: boolean
  port?: number
  error?: string
  phase?: 'config' | 'auth' | 'gateway'
}

// ─── BundleManifest / AppVersionInfo ────────────────────────────────────────

/** Bundle manifest from prepare-bundle (About / Update Center) */
export interface BundleManifest {
  shellVersion: string
  bundledOpenClawVersion: string
}

/** Collected app version info */
export interface AppVersionInfo {
  shell: string
  electron: string
  node: string
  openclaw: string
}

// ─── GatewayStatus ───────────────────────────────────────────────────────────

/** Gateway lifecycle status */
export type GatewayStatusValue = 'starting' | 'running' | 'stopped' | 'error'

/** Gateway child process snapshot */
export interface GatewayStatus {
  running: boolean
  port: number
  pid: number | null
  uptime: number
  status: GatewayStatusValue
}

// ─── Registry (Skills / Extensions / Commands) ──────────────────────────────

/** Skill discovery source */
export type SkillSource = 'bundled' | 'user-workspace' | 'user-extensions' | 'load-path'

/** Extension discovery source */
export type ExtensionSource = 'bundled' | 'user-extensions' | 'load-path'

/** Skill registry row */
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

/** Extension registry row */
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

/** Plugin row from `openclaw plugins list --json` */
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

/** Validation outcome */
export interface ValidationResult {
  ok: boolean
  errors?: string[]
  warnings?: string[]
}

/** Registry export summary */
export interface RegistryExportSummary {
  skills: string[]
  extensions: string[]
  exportedAt: string
}

// ─── Update / Verify / Repair ────────────────────────────────────────────────

/** GitHub release check result */
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

/** Bundled resources verification */
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

/** Pre-start check payload for the renderer */
export interface PrestartCheckFrontend {
  ok: boolean
  bundleOk: boolean
  configExists: boolean
  configParseable: boolean
  errors: string[]
  fixSuggestions: string[]
}

/** Post-update validation (rollback hints for Update Center) */
export interface PostUpdateValidationResult {
  ran: boolean
  ok: boolean
  report?: DiagnosticReport
  rollbackGuidance: string
}

// ─── Diagnostics (Doctor proxy) ────────────────────────────────────────────────

/** Diagnostic severity */
export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'pass'

/** Single diagnostic line */
export interface DiagnosticItem {
  id: string
  level: DiagnosticLevel
  message: string
  fix?: string
  source?: 'cli' | 'prestart' | 'desktop'
}

/** Full diagnostic report */
export interface DiagnosticReport {
  ok: boolean
  items: DiagnosticItem[]
  runAt: string
}
