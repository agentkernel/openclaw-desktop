/**
 * Scan extension dirs for openclaw.plugin.json (lightweight upstream-style discovery).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { OpenClawConfig } from '../../shared/types.js'
import type { ExtensionRegistryItem, ExtensionSource } from '../../shared/types.js'

const PLUGIN_MANIFEST = 'openclaw.plugin.json'
const PACKAGE_JSON = 'package.json'

interface PluginManifest {
  id?: string
  name?: string
  description?: string
  version?: string
  providers?: string[]
  [key: string]: unknown
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function resolvePluginRoot(entryPath: string): string | null {
  const stat = fs.statSync(entryPath)
  if (stat.isFile()) {
    const dir = path.dirname(entryPath)
    return fs.existsSync(path.join(dir, PLUGIN_MANIFEST)) ? dir : null
  }
  if (stat.isDirectory()) {
    return fs.existsSync(path.join(entryPath, PLUGIN_MANIFEST)) ? entryPath : null
  }
  return null
}

function scanDirForExtensions(rootDir: string, source: ExtensionSource): ExtensionRegistryItem[] {
  const results: ExtensionRegistryItem[] = []
  try {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return results
    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const ent of entries) {
      const subPath = path.join(rootDir, ent.name)
      const manifestPath = path.join(subPath, PLUGIN_MANIFEST)
      if (!fs.existsSync(manifestPath)) continue
      const manifest = readJsonSafe<PluginManifest>(manifestPath)
      if (!manifest || typeof manifest !== 'object') continue
      const pkg = readJsonSafe<{ version?: string }>(path.join(subPath, PACKAGE_JSON))
      const id = String(manifest.id ?? ent.name)
      const name = String(manifest.name ?? id)
      const tools = Array.isArray(manifest.tools)
        ? manifest.tools.filter((t): t is string => typeof t === 'string')
        : []
      const commands = Array.isArray(manifest.commands)
        ? manifest.commands.filter((c): c is string => typeof c === 'string')
        : []
      results.push({
        id,
        name,
        description: typeof manifest.description === 'string' ? manifest.description : undefined,
        source,
        enabled: true,
        path: subPath,
        version: manifest.version ?? pkg?.version,
        providers: Array.isArray(manifest.providers)
          ? manifest.providers.filter((p): p is string => typeof p === 'string')
          : undefined,
        tools: tools.length > 0 ? tools : undefined,
        commands: commands.length > 0 ? commands : undefined,
      })
    }
  } catch {
    /* dir missing or unreadable */
  }
  return results
}

function getPluginEnabled(config: OpenClawConfig, pluginId: string): boolean {
  const plugins = config?.plugins as { entries?: Record<string, { enabled?: boolean }> } | undefined
  const entry = plugins?.entries?.[pluginId]
  if (entry && typeof entry.enabled === 'boolean') return entry.enabled
  return true
}

export interface ScanExtensionsOptions {
  getBundledOpenClawPath: () => string
  getUserDataDir: () => string
  readOpenClawConfig: () => OpenClawConfig
}

/**
 * Merge bundled, user extensions, and load.paths
 */
export function scanExtensions(opts: ScanExtensionsOptions): ExtensionRegistryItem[] {
  const config = opts.readOpenClawConfig()
  const bundledOpenClawPath = opts.getBundledOpenClawPath()
  const bundledRoot = path.dirname(bundledOpenClawPath)
  const userDir = opts.getUserDataDir()

  const seen = new Map<string, ExtensionRegistryItem>()

  // 1. Bundled: resources/openclaw/extensions/
  const bundledExtDir = path.join(bundledRoot, 'extensions')
  for (const item of scanDirForExtensions(bundledExtDir, 'bundled')) {
    if (!seen.has(item.id)) {
      item.enabled = getPluginEnabled(config, item.id)
      seen.set(item.id, item)
    }
  }

  // 2. User: ~/.openclaw/extensions/
  const userExtDir = path.join(userDir, 'extensions')
  for (const item of scanDirForExtensions(userExtDir, 'user-extensions')) {
    if (!seen.has(item.id)) {
      item.enabled = getPluginEnabled(config, item.id)
      seen.set(item.id, item)
    }
  }

  // 3. plugins.load.paths
  const loadPaths = (config?.plugins as { load?: { paths?: string[] } })?.load?.paths ?? []
  for (const raw of loadPaths) {
    if (typeof raw !== 'string' || !raw) continue
    const resolved = path.isAbsolute(raw) ? raw : path.join(userDir, raw)
    const root = resolvePluginRoot(resolved)
    if (!root) continue
    const manifestPath = path.join(root, PLUGIN_MANIFEST)
    const manifest = readJsonSafe<PluginManifest>(manifestPath)
    if (!manifest) continue
    const pkg = readJsonSafe<{ version?: string }>(path.join(root, PACKAGE_JSON))
    const id = String(manifest.id ?? path.basename(root))
    if (seen.has(id)) continue
    const item: ExtensionRegistryItem = {
      id,
      name: String(manifest.name ?? id),
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
      source: 'load-path',
      enabled: getPluginEnabled(config, id),
      path: root,
      version: manifest.version ?? pkg?.version,
      providers: Array.isArray(manifest.providers)
        ? manifest.providers.filter((p): p is string => typeof p === 'string')
        : undefined,
    }
    seen.set(id, item)
  }

  return [...seen.values()]
}
