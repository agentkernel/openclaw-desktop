import { Menu, Tray, app, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { GatewayStatusValue } from '../../shared/types.js'
import { getInstallDir, getUserDataDir } from '../utils/paths.js'

export interface TrayManagerOptions {
  appName: string
  onOpenMainWindow: () => void
  onRestartGateway: () => void | Promise<void>
  onOpenSettings?: () => void
  onOpenAbout?: () => void
  onOpenUpdates?: () => void
  onQuit: () => void
}

function getGatewayStatusLabel(status: GatewayStatusValue): string {
  switch (status) {
    case 'running':
      return 'Gateway: Running'
    case 'starting':
      return 'Gateway: Starting'
    case 'error':
      return 'Gateway: Error'
    case 'stopped':
    default:
      return 'Gateway: Stopped'
  }
}

function resolveTrayIconPath(): string | null {
  const installDir = getInstallDir()
  const exePath = app.getPath('exe')
  const candidates = [
    path.join(installDir, 'resources', 'apple-touch-icon.png'),
    path.join(installDir, 'resources', 'tray-icon.png'),
    path.join(installDir, 'resources', 'icon.ico'),
    path.join(installDir, 'build', 'tray-icon.png'),
    path.join(installDir, 'build', 'icon.ico'),
    exePath,
    path.join(path.dirname(app.getPath('exe')), 'resources', 'tray-icon.png'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'icon.ico'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

export class TrayManager {
  private tray: Tray | null = null
  private gatewayStatus: GatewayStatusValue = 'stopped'
  private updateAvailable = false
  private readonly options: TrayManagerOptions

  constructor(options: TrayManagerOptions) {
    this.options = options
  }

  create(): Tray {
    if (this.tray && !this.tray.isDestroyed()) {
      return this.tray
    }

    const iconPath = resolveTrayIconPath()
    const resolvedIcon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
    const icon = resolvedIcon.isEmpty() ? nativeImage.createEmpty() : resolvedIcon
    this.tray = new Tray(icon)
    this.tray.setToolTip(this.options.appName)
    this.tray.on('double-click', () => {
      this.options.onOpenMainWindow()
    })
    this.rebuildMenu()
    return this.tray
  }

  setGatewayStatus(status: GatewayStatusValue): void {
    this.gatewayStatus = status
    this.rebuildMenu()
  }

  setUpdateAvailable(available: boolean): void {
    if (this.updateAvailable !== available) {
      this.updateAvailable = available
      this.rebuildMenu()
    }
  }

  destroy(): void {
    if (!this.tray || this.tray.isDestroyed()) {
      this.tray = null
      return
    }
    this.tray.destroy()
    this.tray = null
  }

  private rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) {
      return
    }

    const template = [
      {
        label: 'Open OpenClaw',
        click: () => this.options.onOpenMainWindow(),
      },
      ...(this.updateAvailable
        ? [
            {
              label: 'Update available',
              click: () => {
                if (this.options.onOpenUpdates) {
                  this.options.onOpenUpdates()
                } else if (this.options.onOpenSettings) {
                  this.options.onOpenSettings()
                }
                this.options.onOpenMainWindow()
              },
            },
          ]
        : []),
      {
        label: getGatewayStatusLabel(this.gatewayStatus),
        enabled: false,
      },
      {
        label: 'Restart Gateway',
        click: () => {
          void this.options.onRestartGateway()
        },
      },
      { type: 'separator' as const },
      {
        label: 'Open config directory',
        click: () => {
          void shell.openPath(getUserDataDir())
        },
      },
      {
        label: 'Settings',
        click: () => {
          if (this.options.onOpenSettings) {
            this.options.onOpenSettings()
            return
          }
          this.options.onOpenMainWindow()
        },
      },
      {
        label: 'About',
        click: () => {
          if (this.options.onOpenAbout) {
            this.options.onOpenAbout()
            return
          }
          this.options.onOpenMainWindow()
        },
      },
      { type: 'separator' as const },
      {
        label: 'Quit',
        click: () => this.options.onQuit(),
      },
    ]

    const menu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(menu)
  }
}
