import { useEffect } from 'react'

export interface ShellLayoutProps {
  title: string
  onBack: () => void
  children: React.ReactNode
  sidebar?: React.ReactNode
  contentClassName?: string
}

export function ShellLayout({
  title,
  onBack,
  children,
  sidebar,
  contentClassName = '',
}: ShellLayoutProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack])

  return (
    <div
      className="flex flex-col select-none animate-in fade-in duration-200"
      role="region"
      aria-label={title}
    >
      {sidebar ? (
        <div className="flex flex-1 min-h-0">
          <aside className="shrink-0 border-r border-border">{sidebar}</aside>
          <section
            className={`flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-6 ${contentClassName}`}
          >
            {children}
          </section>
        </div>
      ) : (
        <section
          className={`flex-1 overflow-y-auto px-4 sm:px-6 py-6 ${contentClassName}`}
        >
          {children}
        </section>
      )}
    </div>
  )
}
