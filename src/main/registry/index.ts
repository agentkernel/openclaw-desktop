/**
 * Registry: skills / extensions / slash commands — scan, persist toggles, import/export.
 */

export { scanSkills } from './skill-scanner.js'
export type { ScanSkillsOptions } from './skill-scanner.js'
export { scanExtensions } from './extension-scanner.js'
export type { ScanExtensionsOptions } from './extension-scanner.js'
export { toggleSkill, toggleExtension } from './config-writer.js'
export type { ConfigWriterDeps } from './config-writer.js'
export { exportRegistry, importRegistry } from './import-export.js'
export type { ImportExportDeps } from './import-export.js'
export {
  listSkills,
  listExtensions,
  validateRegistryItem,
} from './registry-service.js'
export type { RegistryServiceDeps } from './registry-service.js'
