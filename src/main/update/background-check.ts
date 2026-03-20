/**
 * Background update polling from ShellConfig.autoCheckUpdates (default 24h).
 * Non-blocking; notifies via callback when a newer version exists.
 */

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h

type ReadShellConfig = () => { autoCheckUpdates?: boolean; lastUpdateCheck?: string }
type CheckForUpdates = () => Promise<{ hasUpdate: boolean; latestVersion?: string }>
type WriteShellConfig = (partial: { lastUpdateCheck: string }) => void
type OnUpdateFound = (info: { version: string }) => void

let intervalId: ReturnType<typeof setInterval> | null = null

export function startBackgroundUpdateCheck(
  readShellConfig: ReadShellConfig,
  writeShellConfig: WriteShellConfig,
  checkForUpdates: CheckForUpdates,
  onUpdateFound: OnUpdateFound,
): void {
  if (intervalId) return

  const runCheck = async () => {
    const config = readShellConfig()
    if (config.autoCheckUpdates === false) return

    try {
      const result = await checkForUpdates()
      writeShellConfig({ lastUpdateCheck: new Date().toISOString() })
      if (result.hasUpdate && result.latestVersion) {
        onUpdateFound({ version: result.latestVersion })
      }
    } catch {
      // Silent failure — do not block
    }
  }

  // First check after 30s to avoid startup contention
  setTimeout(() => {
    void runCheck()
    intervalId = setInterval(runCheck, CHECK_INTERVAL_MS)
  }, 30_000)
}

export function stopBackgroundUpdateCheck(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
