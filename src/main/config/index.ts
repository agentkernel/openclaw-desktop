/**
 * 配置管理器 — 统一导出
 */

export {
  readOpenClawConfig,
  writeOpenClawConfig,
  openclawConfigExists,
} from './openclaw-config.js'

export {
  readShellConfig,
  writeShellConfig,
  getDefaultShellConfig,
} from './shell-config.js'

export {
  runConfigValidate,
  type ConfigValidationResult,
  type ConfigValidationIssue,
} from './config-validate.js'
