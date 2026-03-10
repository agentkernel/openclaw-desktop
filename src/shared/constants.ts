/**
 * 共享常量 — Main 与 Renderer 共用
 * 与 OpenClaw 官方路径约定一致
 */

/** Gateway 默认端口 */
export const DEFAULT_GATEWAY_PORT = 18789

/** OpenClaw 用户数据目录名（相对 %USERPROFILE%） */
export const OPENCLAW_USER_DIR = '.openclaw'

/** 外壳应用名（用于 %APPDATA% 子目录） */
export const APP_NAME = 'OpenClaw Desktop'

/** OpenClaw 主配置文件名 */
export const OPENCLAW_CONFIG_FILE = 'openclaw.json'

/** 外壳配置文件相对路径（相对于 app.getPath('userData')） */
export const SHELL_CONFIG_FILE = 'config.json'
