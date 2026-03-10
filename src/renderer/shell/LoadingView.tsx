import { Button } from '@/components/ui/button'

interface LoadingViewProps {
  statusText: string
  timedOut?: boolean
  onRetry?: () => void
  hintText?: string
}

function WarningIcon() {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1={12} y1={9} x2={12} y2={13} />
      <line x1={12} y1={17} x2={12.01} y2={17} />
    </svg>
  )
}

export function LoadingView({ statusText, timedOut = false, onRetry, hintText }: LoadingViewProps) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 select-none"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${
            timedOut
              ? 'bg-amber-100 text-amber-600 shadow-amber-500/10'
              : 'bg-primary shadow-primary/20 animate-pulse'
          }`}
        >
          {timedOut ? (
            <WarningIcon />
          ) : (
            <span className="text-2xl font-bold text-primary-foreground tracking-tight">OC</span>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">OpenClaw Desktop</h1>
      </div>

      {!timedOut && (
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 max-w-sm text-center">
        {timedOut && (
          <p className="text-sm font-medium text-foreground">Gateway startup timeout</p>
        )}
        <p className="text-sm text-muted-foreground">{statusText}</p>
        {!timedOut && hintText && (
          <p className="text-xs text-muted-foreground mt-1">{hintText}</p>
        )}
      </div>

      {timedOut && onRetry && (
        <Button onClick={onRetry}>Retry</Button>
      )}
    </main>
  )
}
