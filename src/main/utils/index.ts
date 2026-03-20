/** Main-process util re-exports */

export {
  getInstallDir,
  getUserDataDir,
  getBundledNodePath,
  getBundledOpenClawPath,
} from './paths.js'

export { getPlatformInfo, type PlatformInfo } from './platform.js'

export { checkPort, type PortCheckResult } from './port-check.js'
