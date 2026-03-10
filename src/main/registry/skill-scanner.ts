/**
 * Skill 目录扫描 — 识别 SKILL.md 子目录并解析元数据
 * 与 OpenClaw 原生 skills 发现逻辑对齐（轻量实现）
 */

import fs from 'node:fs'
import path from 'node:path'
import type { OpenClawConfig } from '../../shared/types.js'
import type { SkillRegistryItem, SkillSource } from '../../shared/types.js'

const SKILL_MD = 'SKILL.md'

interface ParsedSkillMeta {
  name?: string
  description?: string
  requires?: { bins?: string[]; env?: string[]; config?: string[] }
}

function parseSkillMd(content: string): ParsedSkillMeta {
  const meta: ParsedSkillMeta = {}
  const lines = content.split('\n')
  let inFrontmatter = false
  const frontmatterLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      }
      // end of frontmatter — parse it
      const yaml = frontmatterLines.join('\n')
      const nameMatch = yaml.match(/(?:^|\n)\s*name:\s*["']?([^"'\n]+)["']?/i)
      const descMatch = yaml.match(/(?:^|\n)\s*description:\s*["']?([^"'\n]+)["']?/i)
      if (nameMatch) meta.name = nameMatch[1].trim()
      if (descMatch) meta.description = descMatch[1].trim()
      const requiresMatch = yaml.match(/(?:^|\n)\s*requires:\s*\n([\s\S]*?)(?=\n\w|\n---|\n$)/)
      if (requiresMatch) {
        const reqBlock = requiresMatch[1]
        const bins = reqBlock.match(/(?:^|\n)\s*bins:\s*\[([^\]]*)\]/)?.[1]
        const env = reqBlock.match(/(?:^|\n)\s*env:\s*\[([^\]]*)\]/)?.[1]
        const config = reqBlock.match(/(?:^|\n)\s*config:\s*\[([^\]]*)\]/)?.[1]
        meta.requires = {}
        if (bins) meta.requires.bins = bins.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        if (env) meta.requires.env = env.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        if (config) meta.requires.config = config.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      }
      break
    }
    if (inFrontmatter) {
      frontmatterLines.push(line)
    } else if (i === 0 && !line.startsWith('#')) {
      meta.description = line.trim().slice(0, 200)
    }
  }

  if (!meta.description && lines.length > 0) {
    const firstNonEmpty = lines.find((l) => l.trim().length > 0)
    if (firstNonEmpty) meta.description = firstNonEmpty.trim().replace(/^#+\s*/, '').slice(0, 200)
  }

  return meta
}

function readSkillMeta(dirPath: string): ParsedSkillMeta | null {
  const skillPath = path.join(dirPath, SKILL_MD)
  try {
    if (!fs.existsSync(skillPath)) return null
    const content = fs.readFileSync(skillPath, 'utf-8')
    return parseSkillMd(content)
  } catch {
    return null
  }
}

/**
 * 扫描单个目录下的 skill 子目录（含 SKILL.md 的即为一 skill）
 */
function scanDirForSkills(rootDir: string, source: SkillSource): SkillRegistryItem[] {
  const results: SkillRegistryItem[] = []
  try {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return results
    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      const subPath = path.join(rootDir, ent.name)
      const meta = readSkillMeta(subPath)
      if (!meta) continue
      const id = ent.name
      const name = meta.name ?? id
      results.push({
        id,
        name,
        description: meta.description,
        source,
        enabled: true,
        path: subPath,
        version: undefined,
        requires: meta.requires,
      })
    }
  } catch {
    /* dir missing or unreadable — skip */
  }
  return results
}

function getSkillEnabled(config: OpenClawConfig, skillKey: string): boolean {
  const skills = config?.skills as { entries?: Record<string, { enabled?: boolean }> } | undefined
  const entry = skills?.entries?.[skillKey]
  if (entry && typeof entry.enabled === 'boolean') return entry.enabled
  return true
}

export interface ScanSkillsOptions {
  getBundledOpenClawPath: () => string
  getUserDataDir: () => string
  readOpenClawConfig: () => OpenClawConfig
}

/**
 * 扫描 skills 目录，合并 bundled、用户 workspace、extraDirs
 */
export function scanSkills(opts: ScanSkillsOptions): SkillRegistryItem[] {
  const config = opts.readOpenClawConfig()
  const bundledOpenClawPath = opts.getBundledOpenClawPath()
  const bundledRoot = path.dirname(bundledOpenClawPath)
  const userDir = opts.getUserDataDir()

  const seen = new Map<string, SkillRegistryItem>()

  // 1. Bundled: resources/openclaw/skills/
  const bundledSkillsDir = path.join(bundledRoot, 'skills')
  for (const item of scanDirForSkills(bundledSkillsDir, 'bundled')) {
    if (!seen.has(item.id)) {
      item.enabled = getSkillEnabled(config, item.id)
      seen.set(item.id, item)
    } else {
      const existing = seen.get(item.id)!
      existing.conflict = `Bundled overrides user (${item.source})`
    }
  }

  // 2. User workspace: ~/.openclaw/skills (or agents workspace)
  const userSkillsDir = path.join(userDir, 'skills')
  for (const item of scanDirForSkills(userSkillsDir, 'user-workspace')) {
    if (!seen.has(item.id)) {
      item.enabled = getSkillEnabled(config, item.id)
      seen.set(item.id, item)
    }
  }

  // 3. skills.load.extraDirs
  const extraDirs = (config?.skills as { load?: { extraDirs?: string[] } })?.load?.extraDirs ?? []
  for (const dir of extraDirs) {
    if (typeof dir !== 'string' || !dir) continue
    const resolved = path.isAbsolute(dir) ? dir : path.join(userDir, dir)
    for (const item of scanDirForSkills(resolved, 'load-path')) {
      if (!seen.has(item.id)) {
        item.enabled = getSkillEnabled(config, item.id)
        seen.set(item.id, item)
      }
    }
  }

  return [...seen.values()]
}
