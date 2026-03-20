/** Persist skill/extension enable flags into openclaw.json */

import type { OpenClawConfig } from '../../shared/types.js'

export interface ConfigWriterDeps {
  readOpenClawConfig: () => OpenClawConfig
  writeOpenClawConfig: (config: OpenClawConfig) => void
}

/**
 * Toggle skill enabled
 */
export function toggleSkill(
  deps: ConfigWriterDeps,
  skillKey: string,
  enabled: boolean
): void {
  const config = deps.readOpenClawConfig()
  const skills = config.skills as { entries?: Record<string, { enabled?: boolean }> } | undefined ?? {}
  const entries = skills.entries ?? {}
  const current = entries[skillKey] ?? {}
  entries[skillKey] = { ...current, enabled }
  const next: OpenClawConfig = {
    ...config,
    skills: { ...skills, entries },
  }
  deps.writeOpenClawConfig(next)
}

/**
 * Toggle extension/plugin enabled
 */
export function toggleExtension(
  deps: ConfigWriterDeps,
  pluginId: string,
  enabled: boolean
): void {
  const config = deps.readOpenClawConfig()
  const plugins = config.plugins as { entries?: Record<string, { enabled?: boolean }> } | undefined ?? {}
  const entries = plugins.entries ?? {}
  const current = entries[pluginId] ?? {}
  entries[pluginId] = { ...current, enabled }
  const next: OpenClawConfig = {
    ...config,
    plugins: { ...plugins, entries },
  }
  deps.writeOpenClawConfig(next)
}
