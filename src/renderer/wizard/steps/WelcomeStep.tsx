import { useTranslation } from 'react-i18next'
import { Brain, MessageSquare, Server, Sparkles } from 'lucide-react'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const FEATURE_KEYS = ['model', 'channel', 'gateway', 'ready'] as const

const FEATURE_ICONS = [
  <Brain key="brain" className="w-5 h-5" />,
  <MessageSquare key="msg" className="w-5 h-5" />,
  <Server key="server" className="w-5 h-5" />,
  <Sparkles key="sparkles" className="w-5 h-5" />,
]

export function WelcomeStep() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-6 max-w-2xl mx-auto">
      <header className="text-center space-y-2.5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
          <span className="text-xl font-bold text-primary-foreground tracking-tight">
            OC
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('wizard.welcome.title')}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          {t('wizard.welcome.subtitle')}
        </p>
      </header>

      <section aria-label="Features" className="grid grid-cols-2 gap-3 w-full">
        {FEATURE_KEYS.map((key, i) => (
          <FeatureCard
            key={key}
            icon={FEATURE_ICONS[i]}
            title={t(`wizard.welcome.features.${key}.title`)}
            description={t(`wizard.welcome.features.${key}.description`)}
          />
        ))}
      </section>

      <p className="text-xs text-muted-foreground mt-2">
        {t('wizard.welcome.startHint')}
      </p>
    </div>
  )
}
