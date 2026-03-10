import type { AppVersionInfo } from '../../shared/types'

/** 格式化主版本行：「Shell vX.Y.Z · OpenClaw vY.Y.Y」 */
export function formatMainVersion(versions: AppVersionInfo): string {
  const shell = `Shell v${versions.shell}`
  const openclaw =
    versions.openclaw === 'unknown'
      ? 'OpenClaw (unknown)'
      : `OpenClaw v${versions.openclaw}`
  return `${shell} · ${openclaw}`
}
