/**
 * 路径工具 — 安装目录、用户数据目录、捆绑资源路径
 * 与 constants.ts 配合使用
 */

import { app } from 'electron'
import path from 'path'
import os from 'os'
import { OPENCLAW_USER_DIR } from '../../shared/constants.js'

/**
 * 获取应用安装目录
 * - 打包后：exe 所在目录
 * - 开发时：项目根目录（process.cwd）
 */
export function getInstallDir(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'))
  }
  return process.cwd()
}

/**
 * 获取 OpenClaw 用户数据目录（%USERPROFILE%\.openclaw）
 */
export function getUserDataDir(): string {
  return path.join(os.homedir(), OPENCLAW_USER_DIR)
}

/**
 * 获取捆绑 Node.js 的 node.exe 路径
 * 打包后：{installDir}/resources/node/node.exe
 */
export function getBundledNodePath(): string {
  return path.join(getInstallDir(), 'resources', 'node', 'node.exe')
}

/**
 * 获取捆绑 OpenClaw 的 openclaw.mjs 路径
 * 打包后：{installDir}/resources/openclaw/openclaw.mjs
 */
export function getBundledOpenClawPath(): string {
  return path.join(getInstallDir(), 'resources', 'openclaw', 'openclaw.mjs')
}
