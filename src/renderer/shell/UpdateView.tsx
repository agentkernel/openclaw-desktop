import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  HardDrive,
  ExternalLink,
  ArrowUpCircle,
  Package,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShellLayout } from './ShellLayout'
import type {
  UpdateCheckResult,
  BundleVerifyResult,
  PrestartCheckFrontend,
  PostUpdateValidationResult,
} from '../../shared/types'
import type { UpdateProgressPayload } from '../../shared/electron-api'
import { formatMainVersion } from '@/utils/version-format'

const RELEASES_URL = 'https://github.com/agentkernel/openclaw-desktop/releases'

export interface UpdateViewProps {
  onBack?: () => void
  updateAvailable?: boolean
  updateVersion?: string
  updateNotes?: string
  onDismissUpdateNotice?: () => void
}

type CheckState = 'idle' | 'checking' | 'done'
type InstallFlowState = 'idle' | 'downloading' | 'downloaded' | 'confirming' | 'installing' | 'error'

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
  ) : (
    <XCircle className="w-4 h-4 text-destructive shrink-0" aria-hidden />
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatEta(remainingBytes: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '--'
  const sec = Math.ceil(remainingBytes / bytesPerSecond)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

export function UpdateView({ onBack, updateAvailable, updateVersion, updateNotes, onDismissUpdateNotice }: UpdateViewProps) {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [updateState, setUpdateState] = useState<CheckState>('idle')
  const [bundleResult, setBundleResult] = useState<BundleVerifyResult | null>(null)
  const [bundleState, setBundleState] = useState<CheckState>('idle')
  const [prestartResult, setPrestartResult] = useState<PrestartCheckFrontend | null>(null)
  const [prestartState, setPrestartState] = useState<CheckState>('idle')

  const [installFlow, setInstallFlow] = useState<InstallFlowState>('idle')
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgressPayload | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [postUpdateResult, setPostUpdateResult] = useState<PostUpdateValidationResult | null>(null)

  const handleCheckUpdate = useCallback(async () => {
    setUpdateState('checking')
    setDownloadError(null)
    setInstallFlow('idle')
    setDownloadProgress(null)
    try {
      const res = await window.electronAPI.updateCheck()
      setUpdateResult(res)
    } catch (e) {
      setUpdateResult({
        hasUpdate: false,
        currentVersion: 'unknown',
        error: e instanceof Error ? e.message : 'Check failed',
      })
    } finally {
      setUpdateState('done')
    }
  }, [])

  const handleVerifyBundle = useCallback(async () => {
    setBundleState('checking')
    try {
      const res = await window.electronAPI.updateVerifyBundle()
      setBundleResult(res)
    } catch (e) {
      setBundleResult({
        ok: false,
        nodeExists: false,
        openclawExists: false,
        missing: [e instanceof Error ? e.message : 'Verification failed'],
        versions: { shell: 'unknown', electron: 'unknown', node: 'unknown', openclaw: 'unknown' },
      })
    } finally {
      setBundleState('done')
    }
  }, [])

  const handlePrestartCheck = useCallback(async () => {
    setPrestartState('checking')
    try {
      const res = await window.electronAPI.updatePrestartCheck()
      setPrestartResult(res)
    } catch (e) {
      setPrestartResult({
        ok: false,
        bundleOk: false,
        configExists: false,
        configParseable: false,
        errors: [e instanceof Error ? e.message : 'Check failed'],
        fixSuggestions: [],
      })
    } finally {
      setPrestartState('done')
    }
  }, [])

  const handleDownloadAndInstall = useCallback(async () => {
    setInstallFlow('downloading')
    setDownloadProgress(null)
    setDownloadError(null)
    const unsub = window.electronAPI.onUpdateProgress((p) => {
      setDownloadProgress(p)
      if (p.error) {
        setDownloadError(p.error)
        setInstallFlow('error')
      } else if (p.completed || p.percent >= 100) {
        setInstallFlow('downloaded')
      }
    })
    try {
      await window.electronAPI.updateDownloadShell()
      setInstallFlow('downloaded')
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e))
      setInstallFlow('error')
    } finally {
      unsub()
    }
  }, [])

  const handleShowInstallConfirm = useCallback(() => {
    setInstallFlow('confirming')
  }, [])

  const handleConfirmInstall = useCallback(async () => {
    setInstallFlow('installing')
    try {
      await window.electronAPI.updateInstallShell()
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e))
      setInstallFlow('error')
    }
  }, [])

  const handleCancelInstallConfirm = useCallback(() => {
    setInstallFlow('downloaded')
  }, [])

  const handleCancelDownload = useCallback(() => {
    window.electronAPI.updateCancelDownload()
    setInstallFlow('idle')
    setDownloadProgress(null)
    setDownloadError(null)
  }, [])

  useEffect(() => {
    void handleVerifyBundle()
  }, [handleVerifyBundle])

  useEffect(() => {
    let cancelled = false
    window.electronAPI.updateGetPostUpdateValidation()
      .then((r) => { if (!cancelled && r.ran) setPostUpdateResult(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const defaultBack = () => {
    window.location.hash = ''
  }
  const onBackFn = onBack ?? defaultBack

  const currentVersionDisplay = bundleResult
    ? formatMainVersion(bundleResult.versions)
    : updateResult?.currentVersion ?? '--'
  const hasUpdate = updateResult?.hasUpdate ?? false
  const latestVersion = updateResult?.latestVersion ?? ''

  return (
    <ShellLayout title="Updates & Maintenance" onBack={onBackFn}>
      <div className="flex flex-col gap-6 max-w-3xl w-full">

        {updateAvailable && updateVersion && updateState === 'idle' && (
          <section className="rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Update available notice">
            <div className="flex items-start gap-3">
              <ArrowUpCircle className="w-4 h-4 text-primary mt-0.5" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-medium">Update available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A newer version is ready to install: <span className="font-mono">Shell v{updateVersion}</span>
                </p>
                {updateNotes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {updateNotes}
                  </p>
                )}
              </div>
              {onDismissUpdateNotice && (
                <Button size="sm" variant="ghost" onClick={onDismissUpdateNotice}>
                  Dismiss
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Check for updates — single-column layout */}
        <section className="rounded-lg border border-border bg-card p-5" aria-label="Check for updates">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpCircle className="w-5 h-5 text-primary" aria-hidden />
            <h2 className="text-base font-semibold">Check for Updates</h2>
          </div>

          {/* Post-update validation (after restart) */}
          {postUpdateResult && postUpdateResult.ran && (
            <div className={`rounded-md border p-3 mb-4 ${postUpdateResult.ok ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                {postUpdateResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden />
                    Update completed successfully
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" aria-hidden />
                    Update completed with issues
                  </>
                )}
              </div>
              {postUpdateResult.rollbackGuidance && (
                <p className="text-xs text-muted-foreground mb-2">{postUpdateResult.rollbackGuidance}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.electronAPI.systemOpenExternal(RELEASES_URL)}
              >
                <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />
                Download previous version
              </Button>
            </div>
          )}

          {updateState === 'idle' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Check if a newer version of OpenClaw Desktop is available on GitHub.
              </p>
              <Button size="sm" onClick={handleCheckUpdate}>
                <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden />
                Check now
              </Button>
            </div>
          )}

          {updateState === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Checking for updates…
            </div>
          )}

          {updateState === 'done' && updateResult && (
            <div className="flex flex-col gap-4">
              {updateResult.error ? (
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">Unable to check for updates</p>
                    <p className="text-muted-foreground mt-1">{updateResult.error}</p>
                  </div>
                </div>
              ) : hasUpdate ? (
                <>
                  {/* Current → available version */}
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Current: <span className="font-mono font-medium">{currentVersionDisplay}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Available: <span className="font-mono font-medium text-primary">Shell v{latestVersion}</span>
                    </p>
                    {updateResult.publishedAt && (
                      <p className="text-xs text-muted-foreground">
                        Published: {new Date(updateResult.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Changelog (Markdown) */}
                  {updateResult.releaseNotes && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Changelog</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_ul]:list-disc [&_ol]:list-decimal [&_pre]:whitespace-pre-wrap [&_pre]:bg-muted/50 [&_pre]:p-2 [&_pre]:rounded">
                        <ReactMarkdown>{updateResult.releaseNotes}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Download progress */}
                  {installFlow === 'downloading' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Downloading…</span>
                        <span className="font-mono">
                          {downloadProgress?.percent != null ? `${Math.round(downloadProgress.percent)}%` : '0%'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${downloadProgress?.percent ?? 0}%` }}
                        />
                      </div>
                      {(downloadProgress?.bytesPerSecond != null || downloadProgress?.transferred != null) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {downloadProgress?.transferred != null && downloadProgress?.total != null
                              ? `${formatBytes(downloadProgress.transferred)} / ${formatBytes(downloadProgress.total)}`
                              : ''}
                          </span>
                          <span>
                            {downloadProgress?.bytesPerSecond != null
                              ? formatSpeed(downloadProgress.bytesPerSecond)
                              : ''}
                            {downloadProgress?.bytesPerSecond != null &&
                            downloadProgress?.transferred != null &&
                            downloadProgress?.total != null
                              ? ` · ETA ${formatEta(downloadProgress.total - downloadProgress.transferred, downloadProgress.bytesPerSecond)}`
                              : ''}
                          </span>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" onClick={handleCancelDownload}>
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Download done → install & restart */}
                  {installFlow === 'downloaded' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                        Download complete. Ready to install.
                      </div>
                      <Button size="sm" onClick={handleShowInstallConfirm}>
                        <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden />
                        Install & Restart
                      </Button>
                    </div>
                  )}

                  {/* Install confirmation */}
                  {installFlow === 'confirming' && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-4 flex flex-col gap-3">
                      <p className="text-sm font-medium">
                        Gateway will temporarily stop. Confirm restart?
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleConfirmInstall}>
                          Confirm & Restart
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelInstallConfirm}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {installFlow === 'installing' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      Installing and restarting…
                    </div>
                  )}

                  {/* Failure + rollback hints */}
                  {installFlow === 'error' && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden />
                        <div>
                          <p className="font-medium text-destructive">Update failed</p>
                          <p className="text-muted-foreground mt-1">{downloadError ?? 'Unknown error'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        To rollback: download a previous installer from the releases page and reinstall. Your configuration will be preserved.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => window.electronAPI.systemOpenExternal(RELEASES_URL)}>
                        <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />
                        View releases
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setInstallFlow('idle'); setDownloadError(null) }}>
                        Try again
                      </Button>
                    </div>
                  )}

                  {/* Initial: in-app download or external installer */}
                  {installFlow === 'idle' && (
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={handleDownloadAndInstall}>
                        <Download className="w-4 h-4 mr-1.5" aria-hidden />
                        Download & Install
                      </Button>
                      <div className="flex gap-2">
                        {updateResult.downloadUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.electronAPI.systemOpenExternal(updateResult.downloadUrl!)}
                          >
                            <Download className="w-4 h-4 mr-1.5" aria-hidden />
                            Download installer manually
                          </Button>
                        )}
                        {updateResult.releaseUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.electronAPI.systemOpenExternal(updateResult.releaseUrl!)}
                          >
                            <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />
                            View release
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                  <span>You are running the latest version ({currentVersionDisplay}).</span>
                </div>
              )}
              <Button size="sm" variant="ghost" className="w-fit" onClick={handleCheckUpdate}>
                <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden />
                Check again
              </Button>
            </div>
          )}
        </section>

        {/* Bundle verification — separate section */}
        <section className="rounded-lg border border-border bg-card p-5" aria-label="Bundle verification">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-primary" aria-hidden />
            <h2 className="text-base font-semibold">Bundle Integrity</h2>
          </div>

          {bundleState === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Verifying bundle…
            </div>
          )}

          {bundleState === 'done' && bundleResult && (
            <div className="flex flex-col gap-3">
              <div className={`flex items-center gap-2 text-sm font-medium ${bundleResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                <StatusIcon ok={bundleResult.ok} />
                {bundleResult.ok ? 'Bundle is complete and valid' : 'Bundle has issues'}
              </div>

              <p className="text-sm font-mono text-muted-foreground" aria-label="Bundle version">
                {formatMainVersion(bundleResult.versions)}
              </p>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusIcon ok={bundleResult.nodeExists} />
                  <span>Node.js runtime</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">{bundleResult.versions.node}</span>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={bundleResult.openclawExists} />
                  <span>OpenClaw package</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">{bundleResult.versions.openclaw}</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                  <span>Electron shell</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">{bundleResult.versions.electron}</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                  <span>App version</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">{bundleResult.versions.shell}</span>
              </dl>

              {bundleResult.missing.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive mb-1">Missing files:</p>
                  <ul className="text-xs text-destructive space-y-0.5">
                    {bundleResult.missing.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Reinstalling the application should resolve missing files.
                  </p>
                </div>
              )}

              <Button size="sm" variant="ghost" className="w-fit" onClick={handleVerifyBundle}>
                <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden />
                Re-verify
              </Button>
            </div>
          )}
        </section>

        {/* System health check */}
        <section className="rounded-lg border border-border bg-card p-5" aria-label="System health check">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" aria-hidden />
            <h2 className="text-base font-semibold">System Health Check</h2>
          </div>

          {prestartState === 'idle' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Run a comprehensive health check including bundle integrity, configuration validity, and service readiness.
              </p>
              <Button size="sm" variant="outline" onClick={handlePrestartCheck}>
                <HardDrive className="w-4 h-4 mr-1.5" aria-hidden />
                Run health check
              </Button>
            </div>
          )}

          {prestartState === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Running health check…
            </div>
          )}

          {prestartState === 'done' && prestartResult && (
            <div className="flex flex-col gap-3">
              <div className={`flex items-center gap-2 text-sm font-medium ${prestartResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                <StatusIcon ok={prestartResult.ok} />
                {prestartResult.ok ? 'All checks passed' : 'Issues detected'}
              </div>

              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusIcon ok={prestartResult.bundleOk} />
                  <span>Bundle integrity</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={prestartResult.configExists} />
                  <span>Configuration file exists</span>
                </div>
                {prestartResult.configExists && (
                  <div className="flex items-center gap-2">
                    <StatusIcon ok={prestartResult.configParseable} />
                    <span>Configuration is valid</span>
                  </div>
                )}
              </dl>

              {prestartResult.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                  <ul className="text-xs text-destructive space-y-0.5">
                    {prestartResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {prestartResult.fixSuggestions.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">Suggestions:</p>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                    {prestartResult.fixSuggestions.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handlePrestartCheck}>
                  <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden />
                  Re-check
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.electronAPI.systemOpenLogDir()}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />
                  Open log directory
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Repair guidance */}
        <section className="rounded-lg border border-border bg-card p-5" aria-label="Repair guidance">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden />
            <h2 className="text-base font-semibold">Repair & Rollback</h2>
          </div>
          <div className="text-sm text-muted-foreground space-y-3">
            <div>
              <p className="font-medium text-foreground mb-1">Reinstall</p>
              <p>If bundle integrity checks fail, download the latest installer from the GitHub releases page and reinstall. Your configuration and data will be preserved.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Reset configuration</p>
              <p>If configuration is corrupt, delete the configuration file and restart the app. The setup wizard will run again to create a fresh configuration.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Rollback</p>
              <p>To rollback to a previous version, download an older installer from the GitHub releases page. Previous releases are always available for download.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.electronAPI.systemOpenExternal(RELEASES_URL)}
            >
              <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />
              View all releases
            </Button>
          </div>
        </section>
      </div>
    </ShellLayout>
  )
}
