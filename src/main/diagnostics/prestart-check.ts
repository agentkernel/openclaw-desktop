/**
 * 启动前校验 — bundle 完整性 + config 存在性 + config 可解析
 */

import path from 'node:path'
import type { OpenClawValidationResult } from '../utils/openclaw-validate.js'
import { validateOpenclawResources } from '../utils/openclaw-validate.js'
import { getInstallDir, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import fs from 'node:fs'
import JSON5 from 'json5'
import { getLogAggregator } from './log-aggregator.js'

export interface PrestartCheckResult {
  ok: boolean
  bundleCheck: OpenClawValidationResult
  configExists: boolean
  configParseable: boolean
  errors: string[]
  fixSuggestions: string[]
}

export function runPrestartCheck(): PrestartCheckResult {
  const aggregator = getLogAggregator()
  const errors: string[] = []
  const fixSuggestions: string[] = []

  const openclawDir = path.join(getInstallDir(), 'resources', 'openclaw')
  const bundleCheck = validateOpenclawResources(openclawDir)

  if (!bundleCheck.ok) {
    errors.push(`Bundle incomplete: missing ${bundleCheck.missing.join(', ')}`)
    fixSuggestions.push('OpenClaw 资源不完整，请重新安装应用。')
    aggregator.append('install-validation', 'error', `Bundle check failed: ${bundleCheck.missing.join(', ')}`)
  } else {
    aggregator.append('install-validation', 'info', 'Bundle check passed')
  }

  const configPath = path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
  const configExists = fs.existsSync(configPath)

  if (!configExists) {
    aggregator.append('install-validation', 'info', `Config not found (wizard will run): ${configPath}`)
  }

  let configParseable = !configExists
  if (configExists) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8')
      JSON5.parse(raw)
      configParseable = true
      aggregator.append('install-validation', 'info', 'Config parse check passed')
    } catch (err) {
      errors.push(`openclaw.json parse error: ${err instanceof Error ? err.message : String(err)}`)
      fixSuggestions.push('openclaw.json 格式错误，请检查或删除后重新运行向导。')
      aggregator.append('install-validation', 'error', `Config parse failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const ok = bundleCheck.ok && (configExists ? configParseable : true)

  return {
    ok,
    bundleCheck,
    configExists,
    configParseable,
    errors,
    fixSuggestions,
  }
}
