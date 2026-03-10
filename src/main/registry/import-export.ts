/**
 * 注册表导入/导出 — 导出选中 skills/plugins 配置为 JSON，支持导入合并
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { OpenClawConfig, RegistryExportSummary } from '../../shared/types.js'

export interface ImportExportDeps {
  getUserDataDir: () => string
  readOpenClawConfig: () => OpenClawConfig
  writeOpenClawConfig: (config: OpenClawConfig) => void
}

interface ExportPayload {
  skills?: { entries?: Record<string, unknown> }
  plugins?: { entries?: Record<string, unknown> }
  meta: RegistryExportSummary
}

/**
 * 导出选中的 skills 和 extensions 配置
 */
export function exportRegistry(
  deps: ImportExportDeps,
  opts: { skills?: string[]; extensions?: string[] }
): { path: string; summary: RegistryExportSummary; checksum: string } {
  const config = deps.readOpenClawConfig()
  const skillsIds = opts.skills ?? []
  const extIds = opts.extensions ?? []

  const skillsEntries =
    skillsIds.length > 0
      ? Object.fromEntries(
          Object.entries((config.skills as { entries?: Record<string, unknown> })?.entries ?? {}).filter(([k]) =>
            skillsIds.includes(k)
          )
        )
      : (config.skills as { entries?: Record<string, unknown> })?.entries ?? {}

  const pluginsConfig = config.plugins as { entries?: Record<string, unknown>; load?: { paths?: string[] } } | undefined
  const pluginEntries =
    extIds.length > 0
      ? Object.fromEntries(
          Object.entries(pluginsConfig?.entries ?? {}).filter(([k]) => extIds.includes(k))
        )
      : pluginsConfig?.entries ?? {}

  const summary: RegistryExportSummary = {
    skills: Object.keys(skillsEntries),
    extensions: Object.keys(pluginEntries),
    exportedAt: new Date().toISOString(),
  }

  const payload: ExportPayload = {
    skills: Object.keys(skillsEntries).length > 0 ? { entries: skillsEntries } : undefined,
    plugins:
      Object.keys(pluginEntries).length > 0 ? { entries: pluginEntries } : undefined,
    meta: summary,
  }

  const userDir = deps.getUserDataDir()
  const outDir = path.join(userDir, 'exports')
  fs.mkdirSync(outDir, { recursive: true })
  const filename = `registry-export-${Date.now()}.json`
  const outPath = path.join(outDir, filename)
  const json = JSON.stringify(payload, null, 2)
  fs.writeFileSync(outPath, json, 'utf-8')
  const checksum = crypto.createHash('sha256').update(json).digest('hex')

  return { path: outPath, summary, checksum }
}

/**
 * 从 JSON 文件导入配置并合并到当前 openclaw.json
 */
export function importRegistry(
  deps: ImportExportDeps,
  opts: { path: string; merge?: boolean }
): { ok: boolean; merged: string[]; errors: string[] } {
  const errors: string[] = []
  const merged: string[] = []

  try {
    const content = fs.readFileSync(opts.path, 'utf-8')
    const payload = JSON.parse(content) as ExportPayload
    if (!payload.meta) {
      return { ok: false, merged: [], errors: ['Invalid export file: missing meta'] }
    }

    const config = deps.readOpenClawConfig()
    const doMerge = opts.merge !== false

    if (payload.skills && typeof payload.skills === 'object' && payload.skills.entries) {
      const skills = config.skills as { entries?: Record<string, unknown> } ?? {}
      const base = doMerge ? (skills.entries ?? {}) : {}
      const entries = { ...base, ...payload.skills.entries }
      config.skills = { ...skills, entries }
      merged.push(...Object.keys(payload.skills.entries as Record<string, unknown>))
    }

    if (payload.plugins && typeof payload.plugins === 'object' && payload.plugins.entries) {
      const plugins = config.plugins as { entries?: Record<string, unknown> } ?? {}
      const base = doMerge ? (plugins.entries ?? {}) : {}
      const entries = { ...base, ...payload.plugins.entries }
      config.plugins = { ...plugins, entries }
      merged.push(...Object.keys(payload.plugins.entries as Record<string, unknown>))
    }

    deps.writeOpenClawConfig(config)
    return { ok: true, merged, errors }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
    return { ok: false, merged: [], errors }
  }
}
