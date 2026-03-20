/**
 * Paths: install dir, OpenClaw state dir, bundled node/openclaw (see constants).
 */

import { app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'node:fs'
import { OPENCLAW_USER_DIR } from '../../shared/constants.js'

/**
 * App install root — packaged: beside exe; dev: process.cwd
 */
export function getInstallDir(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'))
    
  }
  return process.cwd()
}

/**
 * OpenClaw state dir (%USERPROFILE%\\.openclaw)
 */
export function getUserDataDir(): string {
  return path.join(os.homedir(), OPENCLAW_USER_DIR)
}

function resolveDevResourcePath(resourceName: 'node' | 'openclaw'): string {
  const installDir = getInstallDir()
  const resourcesPath = path.join(installDir, 'resources', resourceName)
  const resourceReady =
    resourceName === 'node'
      ? fs.existsSync(path.join(resourcesPath, 'node.exe'))
      : fs.existsSync(path.join(resourcesPath, 'openclaw.mjs'))
  if (resourceReady) {
    return resourcesPath
  }
  return path.join(installDir, 'build', resourceName)
}

export function getBundledOpenClawDir(): string {
  if (app.isPackaged) {
    return path.join(getInstallDir(), 'resources', 'openclaw')
  }
  return resolveDevResourcePath('openclaw')
}

/**
 * Bundled node.exe — {installDir}/resources/node/node.exe
 */
export function getBundledNodePath(): string {
  if (app.isPackaged) {
    return path.join(getInstallDir(), 'resources', 'node', 'node.exe')
  }
  return path.join(resolveDevResourcePath('node'), 'node.exe')
}

/**
 * Bundled openclaw.mjs — {installDir}/resources/openclaw/openclaw.mjs
 */
export function getBundledOpenClawPath(): string {
  return path.join(getBundledOpenClawDir(), 'openclaw.mjs')
}
