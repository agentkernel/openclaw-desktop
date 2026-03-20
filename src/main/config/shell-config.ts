/**
 * Desktop shell config read/write.
 * Path: %APPDATA%\OpenClaw Desktop\config.json
 * Separate from OpenClaw main config; stores shell-only settings.
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { ShellConfig } from '../../shared/types.js'
import { APP_NAME, DEFAULT_GATEWAY_PORT, SHELL_CONFIG_FILE } from '../../shared/constants.js'

function getShellConfigPath(): string {
  return path.join(app.getPath('appData'), APP_NAME, SHELL_CONFIG_FILE)
}

/** Default shell config */
export function getDefaultShellConfig(): ShellConfig {
  return {
    closeToTray: true,
    autoStart: false,
    theme: 'system',
    lastGatewayPort: DEFAULT_GATEWAY_PORT,
    updateChannel: 'stable',
    onboardingMainWindowExpanded: false,
    autoCheckUpdates: true,
    windowBounds: {
      x: -1,
      y: -1,
      width: 980,
      height: 920,
      maximized: false,
    },
  }
}

/**
 * Read shell config.
 * - Missing file → defaults
 * - Parse error → defaults + warning
 */
export function readShellConfig(): ShellConfig {
  const configPath = getShellConfigPath()
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultShellConfig()
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...getDefaultShellConfig(), ...parsed } as ShellConfig
    }
    return getDefaultShellConfig()
  } catch (err) {
    console.warn(
      `[config] Shell config parse failed, using defaults: ${configPath}`,
      err instanceof Error ? err.message : String(err)
    )
    return getDefaultShellConfig()
  }
}

/** Write shell config (atomic rename on Windows). */
export function writeShellConfig(config: ShellConfig): void {
  const configPath = getShellConfigPath()
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true })
  const data = JSON.stringify(config, null, 2) + '\n'
  const tmpPath = `${configPath}.tmp`
  fs.writeFileSync(tmpPath, data, 'utf-8')
  try {
    fs.renameSync(tmpPath, configPath)
  } catch {
    // Windows: rename fails if target exists; remove it and retry
    fs.unlinkSync(configPath)
    fs.renameSync(tmpPath, configPath)
  }
}
