import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { WizardStepDef } from '@/stores/wizard-store'

interface StepIndicatorProps {
  steps: readonly WizardStepDef[]
  currentStep: number
  completedSteps: boolean[]
  onStepClick: (step: number) => void
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label="Wizard steps" className="w-full">
      <ol className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const isCompleted = completedSteps[index]
          const isCurrent = index === currentStep
          const isClickable = index <= currentStep || isCompleted
          const stepLabel = t(`wizard.steps.${step.id}`)

          return (
            <li
              key={step.id}
              className="flex flex-col items-center relative z-10"
              style={{ flex: index === steps.length - 1 ? '0 0 auto' : '1 1 0' }}
            >
              <div className="flex items-center w-full">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0 border-2 relative',
                    isCurrent &&
                      'border-primary bg-primary text-primary-foreground shadow-sm scale-110',
                    isCompleted &&
                      !isCurrent &&
                      'border-primary bg-primary text-primary-foreground',
                    !isCurrent &&
                      !isCompleted &&
                      'border-border bg-background text-muted-foreground',
                    isClickable && !isCurrent && 'hover:border-primary/60 cursor-pointer',
                    !isClickable && 'opacity-50 cursor-not-allowed',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${stepLabel}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    index + 1
                  )}
                </button>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1.5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-colors duration-300',
                        completedSteps[index] ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Label below the dot */}
              <span
                className={cn(
                  'text-[11px] mt-1.5 select-none text-center whitespace-nowrap transition-colors',
                  isCurrent && 'text-foreground font-semibold',
                  isCompleted && !isCurrent && 'text-foreground/70 font-medium',
                  !isCurrent && !isCompleted && 'text-muted-foreground',
                )}
              >
                {stepLabel}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
