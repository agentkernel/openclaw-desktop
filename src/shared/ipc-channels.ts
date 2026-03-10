/**
 * IPC 通道名称常量 — Main 与 Renderer 共用
 * 与 Preload 暴露的 API 对应
 */

// ─── 请求-响应通道（ipcRenderer.invoke / ipcMain.handle）─────────────────────

/** Gateway 启动 */
export const IPC_GATEWAY_START = 'gateway:start' as const

/** Gateway 停止 */
export const IPC_GATEWAY_STOP = 'gateway:stop' as const

/** Gateway 重启 */
export const IPC_GATEWAY_RESTART = 'gateway:restart' as const

/** Gateway 状态查询 */
export const IPC_GATEWAY_STATUS = 'gateway:status' as const

/** 读取 OpenClaw 配置 */
export const IPC_CONFIG_READ = 'config:read' as const

/** 写入 OpenClaw 配置 */
export const IPC_CONFIG_WRITE = 'config:write' as const

/** 检查 OpenClaw 配置文件是否存在 */
export const IPC_CONFIG_EXISTS = 'config:exists' as const

/** 配置 Schema 校验（openclaw config validate --json） */
export const IPC_CONFIG_VALIDATE = 'config:validate' as const

/** 读取外壳配置 */
export const IPC_SHELL_GET_CONFIG = 'shell:getConfig' as const

/** 写入外壳配置 */
export const IPC_SHELL_SET_CONFIG = 'shell:setConfig' as const

/** 获取系统/应用语言（用于 i18n） */
export const IPC_SYSTEM_GET_LOCALE = 'system:getLocale' as const

/** 在系统浏览器中打开 URL */
export const IPC_SYSTEM_OPEN_EXTERNAL = 'system:openExternal' as const

/** 在资源管理器中打开路径 */
export const IPC_SYSTEM_OPEN_PATH = 'system:openPath' as const

/** 检测端口是否可用 */
export const IPC_PORT_CHECK = 'port:check' as const

/** 测试模型连接 */
export const IPC_WIZARD_TEST_MODEL = 'wizard:testModel' as const

/** 向导完成配置 — 原子性写入配置 + 凭证 + 启动 Gateway */
export const IPC_WIZARD_COMPLETE_SETUP = 'wizard:completeSetup' as const

/** 打开日志/用户数据目录 */
export const IPC_SYSTEM_OPEN_LOG_DIR = 'system:openLogDir' as const

/** 获取应用版本信息 */
export const IPC_SHELL_GET_VERSIONS = 'shell:getVersions' as const

/** 进入主界面时调整窗口大小（Gateway Control UI） */
export const IPC_SHELL_RESIZE_FOR_MAIN_INTERFACE = 'shell:resizeForMainInterface' as const

/** 导出脱敏诊断包 */
export const IPC_DIAGNOSTICS_EXPORT = 'diagnostics:export' as const

/** Provider/Auth Profile 管理 — 列表 */
export const IPC_PROVIDERS_LIST = 'providers:list' as const

/** Provider/Auth Profile 管理 — 保存 Profile */
export const IPC_PROVIDERS_SAVE_PROFILE = 'providers:saveProfile' as const

/** Provider/Auth Profile 管理 — 删除 Profile */
export const IPC_PROVIDERS_DELETE_PROFILE = 'providers:deleteProfile' as const

/** Provider/Auth Profile 管理 — 测试连接 */
export const IPC_PROVIDERS_TEST = 'providers:test' as const

/** Provider/Auth Profile 管理 — 导出 */
export const IPC_PROVIDERS_EXPORT = 'providers:export' as const

/** Provider/Auth Profile 管理 — 导入 */
export const IPC_PROVIDERS_IMPORT = 'providers:import' as const

/** Provider/Auth Profile 管理 — 保存 Provider 配置 */
export const IPC_PROVIDERS_SAVE_CONFIG = 'providers:saveProviderConfig' as const

/** Provider/Auth Profile 管理 — 设置模型默认值 */
export const IPC_PROVIDERS_SET_MODEL_DEFAULTS = 'providers:setModelDefaults' as const

/** Skills 清单 */
export const IPC_SKILLS_LIST = 'skills:list' as const

/** Skills 启用/禁用 */
export const IPC_SKILLS_TOGGLE = 'skills:toggle' as const

/** Skills 重新加载（触发刷新） */
export const IPC_SKILLS_RELOAD = 'skills:reload' as const

/** Extensions 清单 */
export const IPC_EXTENSIONS_LIST = 'extensions:list' as const

/** Extensions 启用/禁用 */
export const IPC_EXTENSIONS_TOGGLE = 'extensions:toggle' as const

/** 注册表重新加载 */
export const IPC_REGISTRY_RELOAD = 'registry:reload' as const

/** 注册表导出 */
export const IPC_REGISTRY_EXPORT = 'registry:export' as const

/** 注册表导入 */
export const IPC_REGISTRY_IMPORT = 'registry:import' as const

/** 注册表校验 */
export const IPC_REGISTRY_VALIDATE = 'registry:validate' as const

/** 检查更新（GitHub Release / electron-updater） */
export const IPC_UPDATE_CHECK = 'update:check' as const

/** 下载 Shell 更新 */
export const IPC_UPDATE_DOWNLOAD_SHELL = 'update:downloadShell' as const

/** 安装 Shell 更新（备份后退出并安装） */
export const IPC_UPDATE_INSTALL_SHELL = 'update:installShell' as const

/** 取消更新下载 */
export const IPC_UPDATE_CANCEL_DOWNLOAD = 'update:cancelDownload' as const

/** 获取 bundle 校验结果 */
export const IPC_UPDATE_VERIFY_BUNDLE = 'update:verifyBundle' as const

/** 获取预启动检查结果 */
export const IPC_UPDATE_PRESTART_CHECK = 'update:prestartCheck' as const

/** 获取安装后校验结果（若有，一次性消费） */
export const IPC_UPDATE_GET_POST_UPDATE_VALIDATION = 'update:getPostUpdateValidation' as const

/** 运行完整诊断（Doctor 代理） */
export const IPC_DIAGNOSTICS_RUN = 'diagnostics:run' as const

/** 获取诊断摘要 */
export const IPC_DIAGNOSTICS_SUMMARY = 'diagnostics:summary' as const

/** Models 列表（RPC 代理） */
export const IPC_MODELS_LIST = 'models:list' as const

/** Models 设置默认模型 */
export const IPC_MODELS_SET_DEFAULT = 'models:setDefault' as const

/** Models 设置 fallback 链 */
export const IPC_MODELS_SET_FALLBACKS = 'models:setFallbacks' as const

/** Models 设置别名 */
export const IPC_MODELS_SET_ALIASES = 'models:setAliases' as const

/** Plugins 列表（CLI 代理） */
export const IPC_PLUGINS_LIST = 'plugins:list' as const

/** Plugins 启用/禁用 */
export const IPC_PLUGINS_TOGGLE = 'plugins:toggle' as const

/** Plugins 安装 */
export const IPC_PLUGINS_INSTALL = 'plugins:install' as const

/** Plugins 卸载 */
export const IPC_PLUGINS_UNINSTALL = 'plugins:uninstall' as const

/** 日志 tail（RPC logs.tail 或 aggregator 降级） */
export const IPC_LOGS_TAIL = 'logs:tail' as const

/** 备份创建 */
export const IPC_BACKUP_CREATE = 'backup:create' as const

/** 备份校验 */
export const IPC_BACKUP_VERIFY = 'backup:verify' as const

// ─── 事件推送通道（ipcRenderer.on / mainWindow.webContents.send）─────────────

/** Gateway 状态变化 */
export const IPC_GATEWAY_STATUS_CHANGE = 'gateway:statusChange' as const

/** Gateway 日志输出 */
export const IPC_GATEWAY_LOG = 'gateway:log' as const

/** 流式 Gateway 结构化日志 */
export const IPC_STREAM_GATEWAY_LOGS = 'stream:gateway-logs' as const

/** 有新版本可用 */
export const IPC_UPDATE_AVAILABLE = 'update:available' as const

/** 更新下载进度 */
export const IPC_UPDATE_PROGRESS = 'update:progress' as const

// ─── 通道名集合（便于批量注册/注销）──────────────────────────────────────────

/** 所有请求-响应通道 */
export const IPC_INVOKE_CHANNELS = [
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
] as const

/** 所有事件推送通道 */
export const IPC_EVENT_CHANNELS = [
  IPC_GATEWAY_STATUS_CHANGE,
  IPC_GATEWAY_LOG,
  IPC_STREAM_GATEWAY_LOGS,
  IPC_UPDATE_AVAILABLE,
  IPC_UPDATE_PROGRESS,
] as const
