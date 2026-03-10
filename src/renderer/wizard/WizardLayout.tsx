import { useTranslation } from 'react-i18next'
import {
  useWizardStore,
  WIZARD_STEPS,
  WIZARD_STEP_COUNT,
} from '@/stores/wizard-store'
import { StepIndicator } from './StepIndicator'
import { Button } from '@/components/ui/button'
import { WelcomeStep } from './steps/WelcomeStep'
import { ModelStep } from './steps/ModelStep'
import { ChannelStep } from './steps/ChannelStep'
import { GatewayStep } from './steps/GatewayStep'
import { CompleteStep } from './steps/CompleteStep'
import { ChevronLeft, ChevronRight, SkipForward, Rocket } from 'lucide-react'

const STEP_COMPONENTS = [
  WelcomeStep,
  ModelStep,
  ChannelStep,
  GatewayStep,
  CompleteStep,
] as const

export function WizardLayout() {
  const { t } = useTranslation()
  const store = useWizardStore()
  const { currentStep, completedSteps, deployPhase, deployMessage } = store

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === WIZARD_STEP_COUNT - 1
  const stepDef = WIZARD_STEPS[currentStep]
  const canAdvance = store.isStepValid(currentStep)
  const isDeploying = deployPhase === 'writing' || deployPhase === 'starting'

  const StepContent = STEP_COMPONENTS[currentStep]

  return (
    <div className="h-screen flex flex-col select-none bg-background">
      {/* Top header with branding and step indicator */}
      <header className="shrink-0 border-b border-border bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3">
          {/* Branding */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-primary-foreground tracking-tight">
                OC
              </span>
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none tracking-tight">{t('wizard.appName')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('wizard.setupWizard')}</p>
            </div>
          </div>

          {/* Horizontal step indicator */}
          <StepIndicator
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={store.goToStep}
          />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <StepContent />
        </div>
      </main>

      {/* Bottom navigation bar */}
      <footer className="shrink-0 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div>
            {!isFirstStep && (
              <Button variant="outline" size="sm" onClick={store.prevStep}>
                <ChevronLeft className="w-4 h-4" />
                {t('wizard.nav.previous')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {stepDef.skippable && !isLastStep && (
              <Button variant="ghost" size="sm" onClick={store.nextStep}>
                {t('wizard.nav.skip')}
                <SkipForward className="w-4 h-4" />
              </Button>
            )}
            {isLastStep ? (
              deployPhase === 'idle' || deployPhase === 'error' ? (
                <Button
                  size="sm"
                  onClick={() => void store.triggerDeploy(t)}
                  disabled={isDeploying}
                >
                  <Rocket className="w-4 h-4" />
                  {deployPhase === 'error' ? t('wizard.complete.retry') : t('wizard.complete.confirmStart')}
                </Button>
              ) : isDeploying ? (
                <span className="text-sm text-muted-foreground">{deployMessage}</span>
              ) : null
            ) : (
              <Button
                size="sm"
                onClick={store.nextStep}
                disabled={!canAdvance}
              >
                {isFirstStep ? t('wizard.nav.startSetup') : t('wizard.nav.next')}
                {!isFirstStep && <ChevronRight className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
