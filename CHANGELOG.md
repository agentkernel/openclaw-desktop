# Changelog

All notable changes to OpenClaw Desktop will be documented in this file.

## [0.2.1] - 2026-03-23

### Updated

- **Bundled OpenClaw runtime:** `2026.3.22` (npm `latest`), bringing upstream fixes and features to the Windows installer bundle.

## [0.2.0] - 2026-03-22

### Added

- **Feishu Access panel** — dedicated screen for Feishu credentials, pending pairing requests, pairing-code approval, and allowlist management (Settings, Dashboard, and tray entry points).
- **Pairing IPC (main process)** — list/approve/remove Feishu pairing state via the bundled OpenClaw runtime from the desktop shell.
- **Tray menu localization** — tray labels follow the selected shell/UI language.
- **Installer license assets** — English, Simplified Chinese, and Traditional Chinese license texts for the NSIS flow.
- **`pnpm i18n:zh-tw`** — script to regenerate Traditional Chinese locale strings from Simplified Chinese using OpenCC.

### Changed

- **Shell UX** — refinements across Dashboard, Settings, Wizard, About, Updates, Provider, and Skills views; expanded i18n keys (en, zh-CN, zh-TW, and other locales).
- **Electron builder** — extra resource entries for multilingual licenses where configured.

## [0.1.1] - 2026-03-20

### Fixed

- **Kuae Coding Plan behind HTTPS proxy:** Gateway child process now merges `NO_PROXY` / `no_proxy` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` on spawn so Kuae API calls can bypass broken local TLS through `HTTP(S)_PROXY`. Other providers unchanged. Opt out with `OPENCLAW_SKIP_KUAE_NO_PROXY=1`.

### Updated

- **Bundled OpenClaw runtime:** Updated bundled OpenClaw to the latest version `2026.3.13`, so OpenClaw Desktop supports the latest OpenClaw runtime.

### Documentation

- README Changelog and FAQ (English); Chinese notes in [README.zh-CN.md](./README.zh-CN.md).

## [0.1.0] - 2026-03-10

### Added
- Initial release of OpenClaw Desktop
- NSIS Windows installer with bundled Node.js 22 and OpenClaw
- 5-step setup wizard (Welcome → Model → Channel → Gateway → Complete)
- 50+ AI provider support (Anthropic, OpenAI, Google, Moonshot, xAI, etc.)
- Multi-channel configuration (Feishu, Telegram, Discord, Slack, WhatsApp)
- Desktop management panels (Dashboard, Settings, Updates, LLM API, Skills, About)
- Control UI iframe embedding with OpenClaw Gateway
- System tray integration with gateway status
- Auto-start at login support
- Dark/Light/System theme support
- 7-language internationalization (en, zh-CN, zh-TW, ja, ko, fr, es)
- electron-updater auto-update with stable/beta channels
- Pre-update backup with rotation
- Post-update validation with doctor checks
- Bundle integrity verification
- Diagnostic export (redacted)
- Configuration backup and restore
- Single instance enforcement
- Window state persistence
