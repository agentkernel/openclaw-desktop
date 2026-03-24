# Changelog

All notable changes to OpenClaw Desktop will be documented in this file.

## [0.2.15] - 2026-03-25

### Changed

- **Diagnostics:** Type desktop doctor dependencies with `readOpenClawConfig: () => unknown` and a narrow cast inside `buildDesktopChecks`, avoiding loose `any` while keeping runtime shape checks.

## [0.2.14] - 2026-03-25

### Fixed

- **Local gateway Control UI root:** In non-remote mode, strip `gateway.controlUi.root` when it points outside the bundled `dist/control-ui`, so stale custom paths from older installs no longer load incompatible UI (black page).
- **Gateway auth token injection:** Apply the gateway token redirect patch to `mainFrame` and `subFrame` requests as well as WebSockets, so embedded/iframed Control UI loads authenticated resources correctly.

### Changed

- **Diagnostics:** Doctor adds a desktop warning when `gateway.controlUi.root` is set to a path outside the bundled Control UI (local gateway mode).

## [0.2.13] - 2026-03-24

### Fixed

- **Gateway Control UI black screen (browser and embedded iframe):** Run all bundled OpenClaw child processes with `cwd` set to `resources/openclaw` instead of the install directory. Upstream resolves `process.cwd()/dist/control-ui` before the real bundle path; a stray or partial `dist/control-ui` under the exe folder made HTML load while `assets/*.js` returned 404, leaving a blank dark page.
- **Stale `gateway.controlUi.root`:** On config read, remove `gateway.controlUi.root` when it does not point at a complete built UI (`index.html` plus `assets/*.js`), so copied configs from other machines or broken paths fall back to automatic bundle detection.

## [0.2.1] - 2026-03-24

### Updated

- **Bundled OpenClaw runtime:** `2026.3.22` (npm `latest`), bringing upstream fixes and features to the Windows installer bundle.
- **`download-openclaw`:** When installing the default `latest` dist-tag, logs an explicit `[policy]` line so release/local builds are visibly tied to the npm registry (still overridable via CLI or `OPENCLAW_DESKTOP_BUNDLE_VERSION`).

### Fixed

- **Extension registry:** Scan bundled plugins under `resources/openclaw/dist/extensions` (OpenClaw npm 2026.3+ layout), with fallback to legacy top-level `extensions/`, so the Skills/Extensions UI matches shipped plugins.
- **Embedded Control UI (OpenClaw 2026.3+):** Default and migrated `openclaw.json` set `gateway.controlUi.allowInsecureAuth` for local gateways; main RPC client sends full operator scopes and `tool-events` cap so WebChat/控制台 can load sessions, channels, and nodes.
- **Gateway process liveness:** Desktop health checks use a **TCP connect** to the gateway port first (avoids false SIGTERM when HTTP is backlogged under heavy RPC/plugin load), merge loopback into main-process `NO_PROXY`, require **3 consecutive** failures before auto-restart, and probe every **12s** — health monitoring stays enabled.
- **Control UI iframe:** Remount when the gateway leaves `running` or the gateway **PID** changes so WebSocket reconnects after restarts (same `#token` URL no longer leaves a blank console).
- **Control UI build (`ensure-openclaw-control-ui`):** Copy upstream monorepo `src/` next to `ui/` so Vite can resolve shared imports (e.g. `format-duration`); copy `apps/` (e.g. `OpenClawKit/Resources/tool-display.json`) for imports from `ui/src/ui/tool-display.ts`.
- **ESLint:** Ignore `build/**` so CI/local OpenClaw extract paths are not linted.

### Documentation

- **README.md / README.zh-CN:** Matching sections on OpenClaw **2026.3.22** compatibility — how the bundle tracks npm `latest`, `bundle-manifest.json` vs `prepare-bundle`, Node/OpenClaw paths, Control UI source build, `dist/extensions`, and pointers to upstream breaking changes for plugin authors.
- **CONTRIBUTING.md:** Local Windows packaging notes and `package:prepare-deps`.

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
