/**
 * Post-update validation: marker file, doctor + bundle checks, persisted result.
 * Surfaces rollback hints and diagnostics export in Update Center.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { DiagnosticReport } from '../../shared/types.js'
import { runDiagnostics } from '../diagnostics/doctor-proxy.js'
import { getUserDataDir } from '../utils/paths.js'

const MARKER_FILE = '.post-update-pending'
const RESULT_FILE = '.post-update-result.json'

const ROLLBACK_GUIDANCE = `If the app does not work after an update:
1. Use "Export diagnostics" to capture the current state for troubleshooting.
2. Restore from backup: open %USERPROFILE%\\.openclaw\\backups and run openclaw backup restore.
3. Or download the previous installer from GitHub Releases and reinstall.`

export interface PostUpdateValidationDeps {
  readOpenClawConfig: () => { gateway?: { port?: number } }
  readShellConfig: () => { lastGatewayPort?: number }
  gatewayStatus: () => { running: boolean; status: string }
}

export interface PostUpdateValidationResult {
  ran: boolean
  ok: boolean
  report?: DiagnosticReport
  rollbackGuidance: string
}

function getMarkerPath(): string {
  return path.join(getUserDataDir(), MARKER_FILE)
}

function getResultPath(): string {
  return path.join(getUserDataDir(), RESULT_FILE)
}

/** Call before install: write marker indicating an update install is about to run */
export function writePostUpdateMarker(): void {
  try {
    const markerPath = getMarkerPath()
    const dir = path.dirname(markerPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(markerPath, JSON.stringify({ at: Date.now() }), 'utf-8')
  } catch (err) {
    console.warn('[post-update] Failed to write marker:', err instanceof Error ? err.message : String(err))
  }
}

/** On startup after update: if marker exists, run doctor + bundle checks and persist result */
export async function runPostUpdateValidationIfNeeded(
  deps: PostUpdateValidationDeps,
): Promise<void> {
  const markerPath = getMarkerPath()
  if (!fs.existsSync(markerPath)) {
    return
  }

  try {
    fs.unlinkSync(markerPath)
  } catch {
    // Ignore delete errors
  }

  const resultPath = getResultPath()
  try {
    const report = await runDiagnostics({
      readOpenClawConfig: deps.readOpenClawConfig,
      readShellConfig: deps.readShellConfig,
      gatewayStatus: deps.gatewayStatus,
    })
    const result: PostUpdateValidationResult = {
      ran: true,
      ok: report.ok,
      report,
      rollbackGuidance: ROLLBACK_GUIDANCE,
    }
    const dir = path.dirname(resultPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const result: PostUpdateValidationResult = {
      ran: true,
      ok: false,
      rollbackGuidance: ROLLBACK_GUIDANCE,
    }
    try {
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8')
    } catch {
      console.warn('[post-update] Failed to write result:', message)
    }
  }
}

/** IPC: read and consume post-update validation result (one-shot) */
export function readAndConsumePostUpdateResult(): PostUpdateValidationResult | null {
  const resultPath = getResultPath()
  if (!fs.existsSync(resultPath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(resultPath, 'utf-8')
    fs.unlinkSync(resultPath)
    const parsed = JSON.parse(raw) as PostUpdateValidationResult
    return {
      ran: parsed.ran ?? true,
      ok: parsed.ok ?? false,
      report: parsed.report,
      rollbackGuidance: parsed.rollbackGuidance ?? ROLLBACK_GUIDANCE,
    }
  } catch {
    try {
      fs.unlinkSync(resultPath)
    } catch {
      /* ignore */
    }
    return null
  }
}
