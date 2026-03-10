/**
 * 后台更新检查 — 按 ShellConfig.autoCheckUpdates 定时检查（默认 24h）
 * 不阻塞应用启动，发现新版本时通过回调通知
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
      // 静默失败，不阻塞
    }
  }

  // 延迟 30s 首次检查，避免阻塞启动
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
