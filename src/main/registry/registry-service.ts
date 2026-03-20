/** Orchestrate registry scan + validation */

import fs from 'node:fs'
import type {
  SkillRegistryItem,
  ExtensionRegistryItem,
  ValidationResult,
} from '../../shared/types.js'
import { scanSkills } from './skill-scanner.js'
import { scanExtensions } from './extension-scanner.js'
import type { ScanSkillsOptions } from './skill-scanner.js'
import type { ScanExtensionsOptions } from './extension-scanner.js'

export interface RegistryServiceDeps
  extends ScanSkillsOptions,
    ScanExtensionsOptions {}

export function listSkills(
  deps: RegistryServiceDeps,
  source?: 'all' | 'bundled' | 'user'
): SkillRegistryItem[] {
  const items = scanSkills(deps)
  if (source === 'bundled') return items.filter((s) => s.source === 'bundled')
  if (source === 'user') return items.filter((s) => s.source !== 'bundled')
  return items
}

export function listExtensions(
  deps: RegistryServiceDeps,
  source?: 'all' | 'bundled' | 'user'
): ExtensionRegistryItem[] {
  const items = scanExtensions(deps)
  if (source === 'bundled') return items.filter((e) => e.source === 'bundled')
  if (source === 'user') return items.filter((e) => e.source !== 'bundled')
  return items
}

/**
 * Basic validation: manifest exists, JSON parses
 */
export function validateRegistryItem(
  deps: RegistryServiceDeps,
  kind: 'skill' | 'extension',
  id: string
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (kind === 'skill') {
    const skills = scanSkills(deps)
    const item = skills.find((s) => s.id === id || s.name === id)
    if (!item) {
      errors.push(`Skill "${id}" not found`)
      return { ok: false, errors }
    }
    const skillMd = `${item.path}/SKILL.md`
    try {
      if (!fs.existsSync(skillMd)) {
        errors.push(`SKILL.md not found at ${item.path}`)
      }
    } catch {
      errors.push(`Could not access skill directory`)
    }
  } else {
    const extensions = scanExtensions(deps)
    const item = extensions.find((e) => e.id === id || e.name === id)
    if (!item) {
      errors.push(`Extension "${id}" not found`)
      return { ok: false, errors }
    }
    const manifestPath = `${item.path}/openclaw.plugin.json`
    try {
      if (!fs.existsSync(manifestPath)) {
        errors.push(`openclaw.plugin.json not found at ${item.path}`)
      } else {
        const raw = fs.readFileSync(manifestPath, 'utf-8')
        JSON.parse(raw)
      }
    } catch (e) {
      errors.push(
        e instanceof Error ? e.message : 'Could not parse plugin manifest'
      )
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
