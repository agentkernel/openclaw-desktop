import { Button } from '@/components/ui/button'

export type ErrorType =
  | 'gateway-crash'
  | 'start-failure'
  | 'timeout'
  | 'connection-error'

interface ErrorViewProps {
  errorType: ErrorType
  title: string
  detail?: string
  onRetry?: () => void
  onOpenLogDir: () => void
}

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={8} x2={12} y2={12} />
      <line x1={12} y1={16} x2={12.01} y2={16} />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function ErrorView({
  errorType,
  title,
  detail,
  onRetry,
  onOpenLogDir,
}: ErrorViewProps) {
  const retryable = errorType !== 'connection-error'

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 select-none"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
          <ErrorIcon />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">OpenClaw Desktop</h1>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-sm text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {detail && (
          <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {retryable && onRetry && (
          <Button onClick={onRetry}>Retry</Button>
        )}
        <Button variant="outline" onClick={onOpenLogDir}>
          <FolderIcon />
          Open log directory
        </Button>
      </div>
    </main>
  )
}
