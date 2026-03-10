/**
 * Clean resources/openclaw and dist/win-unpacked using Windows-safe methods.
 * Handles long paths (node_modules deep nesting) that PowerShell Remove-Item cannot.
 * Usage: pnpm run clean-resources
 */

import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const PROJECT_ROOT = process.cwd()
const RESOURCES_OPENCLAW = join(PROJECT_ROOT, 'resources', 'openclaw')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const RESOURCES_ICON = join(PROJECT_ROOT, 'resources', 'icon.ico')
const RESOURCES_TRAY_ICON = join(PROJECT_ROOT, 'resources', 'tray-icon.png')
const RESOURCES_APPLE_ICON = join(PROJECT_ROOT, 'resources', 'apple-touch-icon.png')
const RESOURCES_SIDEBAR = join(PROJECT_ROOT, 'resources', 'installer', 'installer-sidebar.bmp')

function rmLongPath(dir: string): void {
  if (!existsSync(dir)) return
  const winPath = dir.replace(/\//g, '\\')
  const longPath = winPath.startsWith('\\\\?\\') ? winPath : `\\\\?\\${winPath}`
  try {
    execSync(`cmd /c rmdir /s /q "${longPath}"`, { stdio: 'pipe' })
  } catch {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch (err) {
      console.warn(`  [warn] could not remove ${dir}: ${(err as Error).message}`)
    }
  }
}

function main(): void {
  console.log('\nclean-resources: removing resources/openclaw and dist/\n')
  rmLongPath(RESOURCES_OPENCLAW)
  rmLongPath(DIST_DIR)
  rmLongPath(RESOURCES_ICON)
  rmLongPath(RESOURCES_TRAY_ICON)
  rmLongPath(RESOURCES_APPLE_ICON)
  rmLongPath(RESOURCES_SIDEBAR)
  console.log('  OK: clean complete\n')
}

main()
