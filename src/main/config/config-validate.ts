/**
 * Run `openclaw config validate --json` via bundled node.
 * Returns structured issues (field path, message, allowed values) from upstream Zod schema.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import {
  getBundledNodePath,
  getBundledOpenClawPath,
  getInstallDir,
  getUserDataDir,
} from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'

const CONFIG_VALIDATE_TIMEOUT_MS = 30_000

export interface ConfigValidationIssue {
  /** Config field path, e.g. agents.defaults.model.primary */
  path: string
  /** Error text */
  message: string
  /** Allowed values for enum-style errors */
  allowedValues?: string[]
}

export interface ConfigValidationResult {
  /** Whether config passes validation */
  valid: boolean
  /** Path to openclaw.json */
  configPath: string
  /** Issues when valid=false */
  issues: ConfigValidationIssue[]
}

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

function buildCliEnv(): NodeJS.ProcessEnv {
  const nodePath = getBundledNodePath()
  return {
    ...withNodeInPath(process.env, nodePath),
    OPENCLAW_STATE_DIR: getUserDataDir(),
    OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
    OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
    NODE_ENV: 'production',
  }
}

function parseJsonFromStdout(stdout: string): unknown {
  const trimmed = stdout.trim()
  const jsonStart = trimmed.indexOf('{')
  if (jsonStart < 0) {
    throw new Error('No JSON output in config validate stdout')
  }
  const jsonStr = trimmed.slice(jsonStart)
  try {
    return JSON.parse(jsonStr) as unknown
  } catch (err) {
    throw new Error(
      `Failed to parse config validate JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Run validate CLI; if bundle missing (typical in dev), return valid:false with a clear issue.
 */
export async function runConfigValidate(): Promise<ConfigValidationResult> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    return {
      valid: false,
      configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
      issues: [
        {
          path: '__bundle__',
          message: `Bundled Node.js not found: ${nodePath}. Run "pnpm run prepare-bundle" for packaged builds.`,
        },
      ],
    }
  }
  if (!fs.existsSync(openclawPath)) {
    return {
      valid: false,
      configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
      issues: [
        {
          path: '__bundle__',
          message: `Bundled OpenClaw not found: ${openclawPath}. Run "pnpm run prepare-bundle" for packaged builds.`,
        },
      ],
    }
  }

  const fullArgs = [openclawPath, 'config', 'validate', '--json']
  const env = buildCliEnv()

  return new Promise((resolve) => {
    const child = spawn(nodePath, fullArgs, {
      cwd: getInstallDir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        valid: false,
        configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
        issues: [
          {
            path: '__timeout__',
            message: `Config validate timed out after ${CONFIG_VALIDATE_TIMEOUT_MS}ms`,
          },
        ],
      })
    }, CONFIG_VALIDATE_TIMEOUT_MS)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const exitCode = code ?? (signal ? 1 : 0)

      if (exitCode !== 0) {
        try {
          const raw = parseJsonFromStdout(stdout) as Record<string, unknown>
          const valid = raw.valid === true
          const configPath = typeof raw.path === 'string' ? raw.path : path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
          const issuesRaw = Array.isArray(raw.issues) ? raw.issues : []
          const issues: ConfigValidationIssue[] = issuesRaw.map((it: unknown) => {
            const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {}
            const issue: ConfigValidationIssue = {
              path: typeof obj.path === 'string' ? obj.path : '',
              message: typeof obj.message === 'string' ? obj.message : String(obj.message ?? 'Unknown error'),
            }
            if (Array.isArray(obj.allowedValues)) {
              issue.allowedValues = obj.allowedValues.filter((v): v is string => typeof v === 'string')
            }
            return issue
          })
          resolve({ valid, configPath, issues })
        } catch {
          resolve({
            valid: false,
            configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
            issues: [
              {
                path: '__cli__',
                message: stderr.trim() || stdout.trim() || `Config validate exited with code ${exitCode}`,
              },
            ],
          })
        }
        return
      }

      try {
        const raw = parseJsonFromStdout(stdout) as Record<string, unknown>
        const valid = raw.valid === true
        const configPath = typeof raw.path === 'string' ? raw.path : path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE)
        const issuesRaw = Array.isArray(raw.issues) ? raw.issues : []
        const issues: ConfigValidationIssue[] = issuesRaw.map((it: unknown) => {
          const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {}
          const issue: ConfigValidationIssue = {
            path: typeof obj.path === 'string' ? obj.path : '',
            message: typeof obj.message === 'string' ? obj.message : String(obj.message ?? 'Unknown error'),
          }
          if (Array.isArray(obj.allowedValues)) {
            issue.allowedValues = obj.allowedValues.filter((v): v is string => typeof v === 'string')
          }
          return issue
        })
        resolve({ valid, configPath, issues })
      } catch (err) {
        resolve({
          valid: false,
          configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
          issues: [
            {
              path: '__parse__',
              message: err instanceof Error ? err.message : 'Failed to parse config validate output',
            },
          ],
        })
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        valid: false,
        configPath: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
        issues: [
          {
            path: '__spawn__',
            message: err.message || 'Failed to run config validate',
          },
        ],
      })
    })
  })
}
