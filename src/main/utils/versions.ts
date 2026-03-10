import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { AppVersionInfo, BundleManifest } from '../../shared/types.js'

function readBundleManifest(installDir: string): BundleManifest | null {
  try {
    const manifestPath = path.join(installDir, 'resources', 'bundle-manifest.json')
    if (!fs.existsSync(manifestPath)) return null
    const raw = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as BundleManifest
    if (manifest.shellVersion && manifest.bundledOpenClawVersion) return manifest
  } catch {
    // manifest missing or invalid (dev mode, unpackaged)
  }
  return null
}

export function getAppVersions(installDir: string): AppVersionInfo {
  const manifest = readBundleManifest(installDir)
  let openclawVersion = 'unknown'
  if (manifest) {
    openclawVersion = manifest.bundledOpenClawVersion
  } else {
    try {
      const pkgPath = path.join(installDir, 'resources', 'openclaw', 'node_modules', 'openclaw', 'package.json')
      const raw = fs.readFileSync(pkgPath, 'utf-8')
      const pkg = JSON.parse(raw) as { version?: string }
      if (pkg.version) openclawVersion = pkg.version
    } catch {
      // Bundled OpenClaw not found (dev mode or not yet installed)
    }
  }

  const shellVersion = manifest?.shellVersion ?? app.getVersion()

  return {
    shell: shellVersion,
    electron: process.versions.electron,
    node: process.versions.node,
    openclaw: openclawVersion,
  }
}
