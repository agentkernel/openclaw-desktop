import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useWizardStore, generateAuthToken } from '@/stores/wizard-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Shield,
  Globe,
  Radio,
} from 'lucide-react'
import type { GatewayWizardConfig } from '../../../shared/types'

// ─── Bind Options ─────────────────────────────────────────────────────────────

type BindValue = GatewayWizardConfig['bind']

interface BindOption {
  value: BindValue
  labelKey: string
  tagKey?: string
  icon: React.ReactNode
  descriptionKey: string
}

const BIND_OPTIONS: readonly BindOption[] = [
  {
    value: 'loopback',
    labelKey: 'wizard.gateway.loopback',
    tagKey: 'wizard.gateway.recommended',
    icon: <Shield className="w-4 h-4" />,
    descriptionKey: 'wizard.gateway.loopbackDesc',
  },
  {
    value: 'lan',
    labelKey: 'wizard.gateway.lan',
    icon: <Radio className="w-4 h-4" />,
    descriptionKey: 'wizard.gateway.lanDesc',
  },
  {
    value: 'auto',
    labelKey: 'wizard.gateway.auto',
    icon: <Globe className="w-4 h-4" />,
    descriptionKey: 'wizard.gateway.autoDesc',
  },
] as const

// ─── Port Check State ─────────────────────────────────────────────────────────

type PortCheckStatus = 'idle' | 'checking' | 'available' | 'occupied' | 'error'

interface PortCheckState {
  status: PortCheckStatus
  message: string
  suggestedPort?: number
}

const MAX_PORT_SCAN = 100

// ─── Component ────────────────────────────────────────────────────────────────

export function GatewayStep() {
  const { t } = useTranslation()
  const { gatewayConfig, setGatewayConfig } = useWizardStore()
  const [portCheck, setPortCheck] = useState<PortCheckState>({
    status: 'idle',
    message: '',
  })

  const handlePortChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10)
      if (!Number.isNaN(num)) {
        setGatewayConfig({ port: Math.min(65535, Math.max(0, num)) })
      } else if (value === '') {
        setGatewayConfig({ port: 0 })
      }
      setPortCheck({ status: 'idle', message: '' })
    },
    [setGatewayConfig],
  )

  const handleCheckPort = useCallback(async () => {
    const port = gatewayConfig.port
    if (port < 1024 || port > 65535) {
      setPortCheck({
        status: 'error',
        message: t('wizard.gateway.portRange'),
      })
      return
    }

    setPortCheck({ status: 'checking', message: '' })

    try {
      const result = await window.electronAPI.portCheck(port)

      if (result.available) {
        setPortCheck({ status: 'available', message: t('wizard.gateway.portAvailable', { port }) })
        return
      }

      const pidInfo = result.pid ? ` (PID: ${result.pid})` : ''
      let suggestedPort: number | undefined

      for (let p = port + 1; p <= Math.min(port + MAX_PORT_SCAN, 65535); p++) {
        const check = await window.electronAPI.portCheck(p)
        if (check.available) {
          suggestedPort = p
          break
        }
      }

      setPortCheck({
        status: 'occupied',
        message: `${t('wizard.gateway.portOccupied', { port })}${pidInfo}`,
        suggestedPort,
      })
    } catch {
      setPortCheck({ status: 'error', message: t('wizard.gateway.portCheckFailed') })
    }
  }, [gatewayConfig.port, t])

  const handleUseSuggested = useCallback(() => {
    if (portCheck.suggestedPort) {
      setGatewayConfig({ port: portCheck.suggestedPort })
      setPortCheck({
        status: 'available',
        message: t('wizard.gateway.useSuggested', { port: portCheck.suggestedPort }),
      })
    }
  }, [portCheck.suggestedPort, setGatewayConfig, t])

  const handleBindChange = useCallback(
    (value: BindValue) => {
      setGatewayConfig({ bind: value })
    },
    [setGatewayConfig],
  )

  const handleRegenerateToken = useCallback(() => {
    setGatewayConfig({ authToken: generateAuthToken() })
  }, [setGatewayConfig])

  const portOutOfRange =
    gatewayConfig.port !== 0 &&
    (gatewayConfig.port < 1024 || gatewayConfig.port > 65535)

  return (
    <div className="space-y-5 sm:space-y-6 max-w-2xl mx-auto">
      <header>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t('wizard.gateway.title')}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('wizard.gateway.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Port */}
        <fieldset className="space-y-1.5">
          <label htmlFor="gateway-port" className="text-sm font-medium">
            {t('wizard.gateway.port')} <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-3">
            <Input
              id="gateway-port"
              type="number"
              min={1024}
              max={65535}
              value={gatewayConfig.port || ''}
              onChange={(e) => handlePortChange(e.target.value)}
              placeholder="18789"
              className="w-32 font-mono tabular-nums"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCheckPort()}
              disabled={
                portCheck.status === 'checking' || gatewayConfig.port === 0
              }
            >
              {portCheck.status === 'checking' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {portCheck.status === 'checking' ? t('wizard.gateway.checking') : t('wizard.gateway.checkPort')}
            </Button>
          </div>

          {portOutOfRange && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              {t('wizard.gateway.portRange')}
            </p>
          )}

          {portCheck.status === 'available' && (
            <p className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {portCheck.message}
            </p>
          )}

          {portCheck.status === 'occupied' && (
            <div className="space-y-1.5">
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {portCheck.message}
              </p>
              {portCheck.suggestedPort && (
                <button
                  type="button"
                  onClick={handleUseSuggested}
                  className="text-xs text-primary hover:underline"
                >
                  {t('wizard.gateway.useSuggested', { port: portCheck.suggestedPort })}
                </button>
              )}
            </div>
          )}

          {portCheck.status === 'error' && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              {portCheck.message}
            </p>
          )}
        </fieldset>

        {/* Auth Token */}
        <fieldset className="space-y-1.5">
          <label htmlFor="gateway-token" className="text-sm font-medium">
            {t('wizard.gateway.authToken')} <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-3">
            <Input
              id="gateway-token"
              type="text"
              value={gatewayConfig.authToken}
              onChange={(e) => setGatewayConfig({ authToken: e.target.value })}
              placeholder={t('wizard.gateway.authToken')}
              className="flex-1 font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateToken}
              aria-label={t('wizard.gateway.regenerate')}
            >
              <RefreshCw className="w-4 h-4" />
              {t('wizard.gateway.regenerate')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('wizard.gateway.tokenHint')}
          </p>
        </fieldset>
      </div>

      {/* Bind Address */}
      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium">
          {t('wizard.gateway.bindAddress')} <span className="text-destructive">*</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Bind address selection">
          {BIND_OPTIONS.map((opt) => {
            const isSelected = gatewayConfig.bind === opt.value
            return (
              <label
                key={opt.value}
                className={[
                  'flex flex-col items-start gap-2 rounded-lg border p-2.5 sm:p-3 cursor-pointer transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="radio"
                    name="gateway-bind"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => handleBindChange(opt.value)}
                    className="h-4 w-4 accent-primary shrink-0"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5 flex-1">
                    <span className="text-muted-foreground">{opt.icon}</span>
                    {t(opt.labelKey)}
                  </span>
                  {opt.tagKey && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      {t(opt.tagKey)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {t(opt.descriptionKey)}
                </p>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
