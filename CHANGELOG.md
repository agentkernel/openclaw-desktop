# Changelog

All notable changes to OpenClaw Desktop will be documented in this file.

## [Unreleased]

## [0.4.10] - 2026-03-27

### Added

- **设置 → 模型：** 新增「模型」区块，可从 `openclaw.json` 加载当前默认/按 Agent 的模型配置，编辑提供商、模型 ID、API Key（及 Moonshot 区域等），支持连接测试，并写回配置与 `auth-profiles`（与向导逻辑对齐）。
- **打包：** 对随包 OpenClaw 飞书通道做 `registerFull` 一次性防护补丁（`patch-openclaw-feishu-register-once`），避免 `registrationMode: full` 下重复注册工具并刷屏日志。

### Changed

- **Release：** Shell `0.4.10+openclaw.2026.3.24`；`prepare-bundle` 后 `resources/bundle-manifest.json` 与 `package.json` 对齐。

## [0.4.9] - 2026-03-27

### Fixed

- **MiniMax / wizard:** Align generated `openclaw.json` with onboard-style configs: `auth.order.minimax` uses `["global"]`, `agents.defaults.model.primary` uses the bare model id, `models.providers.minimax` includes `apiKey` alongside auth-profiles, and config load keeps the inline key (sync to `minimax:global` without stripping JSON). Migration rewrites legacy `["minimax:global"]` order entries to `["global"]`.
- **Wizard model list (MiniMax):** Default preset is `MiniMax-M2.7-highspeed` (first in list); dropdown labels use the exact API model ids (including `-highspeed` / hyphen suffixes) so they match `openclaw.json`.

### Changed

- **Release:** Shell `0.4.9+openclaw.2026.3.24`; `resources/bundle-manifest.json` `shellVersion` aligned with `package.json`.

## [0.4.8] - 2026-03-27

### Fixed

- **Setup wizard (MiniMax):** Default `models.providers.minimax.baseUrl` uses `https://api.minimaxi.com/anthropic`, matching working user configs; `api.minimax.io` can break Anthropic-compatible routing for some accounts.

### Changed

- **Release:** Shell `0.4.8+openclaw.2026.3.24`; `resources/bundle-manifest.json` `shellVersion` aligned with `package.json`.

## [0.4.7] - 2026-03-27

### Changed

- **Release:** Bump Shell version to `0.4.7+openclaw.2026.3.24`; `resources/bundle-manifest.json` `shellVersion` aligned with `package.json`.

## [0.4.6] - 2026-03-28

### Changed

- **CI / Release:** Document pnpm `cache: pnpm` behavior; set `cache-dependency-path: pnpm-lock.yaml` on `setup-node`; print checkout ref + SHA + one-line log in verify / release jobs for build provenance. Windows packaging: widen Electron binary cache key with `electron-builder.config.cjs` / `electron-builder.yml` so invalidation tracks builder config changes, not only the lockfile.
- **Gateway:** When a MiniMax auth profile is configured and inherited `MINIMAX_*` env keys are stripped for the child process, log whether the guard ran and which keys were removed (or that none were present).

## [0.4.5] - 2026-03-27

### Fixed

- **Release metadata:** `resources/bundle-manifest.json` `shellVersion` is aligned with `package.json` so `check-openclaw-versions` / packaged builds report the correct shell version (follow-up to v0.4.4 tag pointing at a commit before manifest sync).

## [0.4.4] - 2026-03-27

### Fixed

- **MiniMax HTTP 401 (follow-up):** Run config migrations **immediately before spawning the gateway** so `openclaw.json` on disk is corrected before the child reads it. MiniMax `anthropic-messages` entries now persist **`authHeader: false` whenever it was not already `false`** (not only when it was `true`), so upstream rewrites cannot leave an ambiguous default that still sends Bearer.
- **MiniMax env vs profile:** When `auth.profiles` includes a `minimax:*` profile, the gateway child environment no longer passes through `MINIMAX_API_KEY` / `MINIMAX_CODE_PLAN_KEY` from the desktop process, so profile-based credentials are not overridden by stray shell env.

### Changed

- **Gateway logs:** Dedupe repeated Feishu tool registration lines within a short window and emit a single summary line when many repeats are suppressed.

## [0.4.3] - 2026-03-26

### Fixed

- **MiniMax 401 when `openclaw.json` key looks correct:** OpenClaw resolves credentials as **auth-profiles.json → env → `models.providers.*.apiKey`**. A stale **`minimax:global`** entry in `auth-profiles.json` overrides the key embedded under `models.providers.minimax`, so edits to JSON alone could still yield `invalid api key`. On config load (and after wizard / provider config writes), **`models.providers.minimax.apiKey` is synced into `minimax:global` and removed from JSON** so the profile and gateway always agree. The setup wizard no longer duplicates API keys into `models.providers` for providers that use auth profiles.

## [0.4.2] - 2026-03-26

### Fixed

- **MiniMax HTTP 401 `invalid api key`:** MiniMax’s Anthropic-compatible API (`https://api.minimax.io/anthropic`) expects **Anthropic-style `x-api-key`** (official docs: `ANTHROPIC_API_KEY` + Anthropic SDK). The shell had set `authHeader: true` (**Bearer**), which MiniMax rejects even when the key is valid. The MiniMax seed no longer sets Bearer; existing `openclaw.json` entries are migrated to **`authHeader: false`** on load. The blanket third-party `anthropic-messages` migration **excludes** MiniMax; OpenCode Zen, Kimi Coding, Synthetic, Cloudflare AI Gateway, etc. are unchanged.

### Changed

- **Feishu DM pairing notifications:** Replaced the 12s polling loop with **`fs.watch` on `~/.openclaw/credentials`** (debounced) so pairing JSON updates drive notifications; **dedupe by `openId`** and a short throttle when `openId` is missing to avoid repeated toasts when the pairing code rotates.

## [0.4.1] - 2026-03-26

### Changed

- **Setup wizard:** Before writing `openclaw.json` and `auth-profiles.json`, the wizard now **sanitizes** (trims) API keys, model IDs, custom provider fields, Cloudflare gateway fields, and the gateway auth token so pasted values match runtime configuration.
- **Custom provider:** Wizard output now includes an **`agents.defaults.models`** alias entry for the selected model, consistent with built-in provider seeds from `ensureProviderSeedConfig`.

## [0.3.4] - 2026-03-26

### Fixed

- **MiniMax / third-party Anthropic HTTP 401:** Aligned with OpenClaw `extensions/minimax/onboard.ts` by setting **`authHeader: true`** on `anthropic-messages` providers that target non-`api.anthropic.com` hosts (MiniMax, Synthetic, OpenCode Zen, Kimi Coding, Cloudflare AI Gateway). Existing `openclaw.json` entries are migrated on load. Custom Anthropic-compatible bases get the same flag when the URL is not Anthropic’s official API.

## [0.3.3] - 2026-03-26

### Fixed

- **MiniMax (401):** OpenClaw and the setup wizard use auth profile **`minimax:global`**, but the LLM API path normalized `default` to **`minimax:default`**, so the gateway looked up the wrong profile. `normalizeAuthOrderEntry` now maps MiniMax `default` / `minimax:default` → **`minimax:global`**; `auth-profiles.json` migration renames `minimax:default` to `minimax:global` when needed.

## [0.3.2] - 2026-03-26

### Fixed

- **Model auth (401) hardening:** LLM API “save profile” now always stores credentials under **canonical profile ids** (`provider:name`) via `normalizeAuthOrderEntry`, matching `auth.order`. Startup migrates shorthand keys in `auth-profiles.json`; reading `openclaw.json` normalizes `auth.order` entries. Custom provider / wizard auth writes trim API keys. Delete profile accepts optional `provider` and resolves ids consistently with save.

## [0.3.1] - 2026-03-26

### Fixed

- **Upstream model auth (401):** Wizard-generated `auth.order` now uses **full profile IDs** (e.g. `minimax:global`) to match OpenClaw’s configuration reference and the LLM API “save profile” path. `addProfileToAuthOrder` / `removeProfileFromAuthOrder` normalize shorthand entries (`global` vs `minimax:global`) so the gateway resolves the same credential as `auth-profiles.json`.
- **Xiaomi MiMo seed config:** Provider seed uses `https://api.xiaomimimo.com/v1` with `openai-completions`, aligned with upstream provider docs (was incorrectly pointed at an Anthropic-style path).

### Changed

- **Wizard model presets:** Provider/model dropdowns updated to match bundled OpenClaw **2026.3.23-2** (MiniMax M2.7 lineup, xAI Grok catalog, Synthetic `hf:*` IDs, Kilo `kilo/auto`, Volcengine naming, Vercel ordering, etc.). See `src/renderer/constants/provider-presets.ts`.

## [0.3.0] - 2026-03-25

### Fixed

- **Embedded Control UI:** Removed the WebSocket **operator pre-probe** (`gateway:probeOperator`) that blocked the main iframe until a main-process RPC connect succeeded. On some gateway builds the probe never completed (repeated `[ws] closed before connect` / code 1005) while the browser Control UI could still connect, which left the shell stuck on **Gateway starting**. The shell again mounts the Control UI iframe as soon as the gateway is **running** and the control URL (with token hash) is known—same as pre-0.3.0 behavior, so the console always loads.
- **Config read timeout:** When building the control URL, `config:read` is raced with a **10s** timeout so a hung IPC cannot leave the shell on the loading screen indefinitely (falls back to a URL without `#token=`).

## [0.2.22] - 2026-03-25

### Fixed

- **Control UI (Lit field decorators in Electron):** Before building OpenClaw `ui/` from GitHub sources, apply desktop-only Vite/tsconfig patches so Lit `@property` / `@state` emit legacy decorator semantics Chromium in Electron accepts; remove any prepackaged npm `dist/control-ui` so the bundle is always rebuilt with that config. Track installs with `.electron-lit-compat-v1` and rebuild when the marker is missing (avoids `Unsupported decorator location: field` at runtime).

## [0.2.21] - 2026-03-25

### Fixed

- **Control UI (embedded gateway dashboard):** After the upstream Vite build, run a **desktop-only** esbuild pass on `dist/control-ui` (`target: chrome130`) so TC39 decorators and similar syntax no longer crash the Electron renderer (black screen). No changes to the OpenClaw upstream repo.
- **In-app updates:** Map shell “stable” channel to electron-updater channel **`latest`** so GitHub **`latest.yml`** is fetched instead of a non-existent **`stable.yml`**.

## [0.2.20] - 2026-03-25

### Changed

- **Electron:** Upgrade to **41.x** (Chromium **146**) so the embedded browser can parse modern gateway Control UI bundles that rely on current JS syntax (e.g. class decorators), closer to system Chrome.

### Fixed

- **Gateway response headers:** Only apply CSP / `frame-ancestors` relaxation on `mainFrame` / `subFrame` responses; do not inject synthetic CSP on `script` and other subresource types (avoids breaking JS module loads).

## [0.2.18] - 2026-03-25

### Changed

- **Release CI:** Workflow sets `OPENCLAW_SKIP_NPM_LATEST_CHECK=1` so `check-openclaw-versions` validates the committed pin + `bundle-manifest` + on-disk artifacts without querying or warning against npm `openclaw@latest`.

### Documentation

- **README.md / README.zh-CN.md:** Describe pinned OpenClaw (`openclawBundleVersion`), current bundle `2026.3.23-2`, and the CI/version-check behavior; align installer filename and download table with **v0.2.18**.

### Added

- **`scripts/check-openclaw-versions.ts`:** `--skip-npm-latest-check` and `OPENCLAW_SKIP_NPM_LATEST_CHECK` to skip the npm registry latest comparison (used by Release CI).

## [0.2.17] - 2026-03-25

### Added

- **Pinned OpenClaw bundle:** Root `package.json` field `openclawBundleVersion`; `download-openclaw` and CI Control UI build read it first (override via `OPENCLAW_DESKTOP_BUNDLE_VERSION` or CLI), reducing npm `latest` drift between jobs.
- **`verify-packaged-win`:** After `electron-builder`, validates `app.asar` / `bundle-manifest.json` / bundled OpenClaw / Control UI asset refs in `win-unpacked` so mixed artifacts fail the build.

### Documentation

- **`INSTALLER_BLACKSCREEN_POSTMORTEM.zh-CN.md`:** Release hardening section updated to reflect implemented checks.

## [0.2.16] - 2026-03-25

### Added

- **Install integrity (packaged):** Pre-start check compares `resources/bundle-manifest.json` `shellVersion` to `app.getVersion()`, and fails fast when the manifest is missing, unreadable, or mismatched (mixed/stale installer layout).
- **Bundle validation:** `validateOpenclawResources` now verifies Control UI `index.html` references an on-disk module script under `dist/control-ui`, catching incomplete or broken UI bundles before launch.

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
