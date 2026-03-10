# Architecture

`OpenClaw Desktop` packages the upstream `OpenClaw` runtime into a Windows desktop shell that is easier to install, configure, update, and support.

## High-Level Components

```text
Electron main process
├─ window and tray management
├─ gateway lifecycle management
├─ configuration and diagnostics
├─ update service and release integration
└─ IPC handlers exposed through preload

Renderer process
├─ setup wizard
├─ dashboard and settings
├─ update center
└─ diagnostics and support UI

Bundled resources
├─ portable Node.js runtime
└─ bundled OpenClaw package
```

## Runtime Flow

1. The installer places the Electron shell, bundled Node.js runtime, and bundled OpenClaw resources on disk.
2. On first launch, the setup wizard collects model, channel, and gateway configuration.
3. The main process manages the OpenClaw gateway lifecycle and exposes status to the renderer through IPC.
4. The renderer provides the desktop UX for configuration, diagnostics, and maintenance.
5. Updates are published through GitHub Releases and consumed by `electron-updater`.

## Packaging Flow

1. `pnpm run download-node` downloads the portable Node.js runtime used inside the installer.
2. `pnpm run download-openclaw` installs and prepares the upstream OpenClaw package for bundling.
3. `pnpm run prepare-bundle` copies and verifies packaged resources.
4. `pnpm run package:win` builds the Electron app and creates the NSIS installer.

## Key Directories

- `src/main`: Electron main process, gateway manager, updater, diagnostics, IPC
- `src/preload`: renderer bridge
- `src/renderer`: React UI
- `src/shared`: shared types and constants
- `scripts`: build, packaging, and release scripts
- `resources`: icons and bundle metadata
- `.github/workflows`: CI and release automation
