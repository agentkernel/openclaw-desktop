/**
 * Main 进程工具函数 — 统一导出
 */

export {
  getInstallDir,
  getUserDataDir,
  getBundledNodePath,
  getBundledOpenClawPath,
} from './paths.js'

export { getPlatformInfo, type PlatformInfo } from './platform.js'

export { checkPort, type PortCheckResult } from './port-check.js'
