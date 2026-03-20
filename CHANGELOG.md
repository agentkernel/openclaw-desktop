# Changelog

All notable changes to OpenClaw Desktop will be documented in this file.

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
