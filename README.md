<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>
<p align="center">龙虾智能体官方中文桌面版一键安装部署EXE程序</p>

<p align="center">
  <strong>Official-style Windows installer &amp; desktop app for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.</strong><br />
  One-click install, bundled runtime, guided setup — run OpenClaw AI agents on Windows without touching a terminal.
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=latest+release" alt="Latest release" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/releases">
    <img src="https://img.shields.io/github/downloads/agentkernel/openclaw-desktop/total?style=flat-square&color=16a34a&label=downloads" alt="Downloads" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/agentkernel/openclaw-desktop?style=flat-square" alt="License" />
  </a>
</p>

<p align="center">
  <img src="resources/demo.gif" alt="OpenClaw Desktop Demo running on Windows" width="720" />
</p>

<p align="center">
  ⭐ &nbsp;If this project helps you, <strong>please give it a star</strong> — it takes 2 seconds and means a lot!&nbsp; ⭐
</p>

---

**Language:** English · [简体中文](./README.zh-CN.md)

---

## What is this?

**OpenClaw Desktop** packages the OpenClaw runtime into a standard Windows install experience. Download one `.exe`, finish a setup wizard, and run OpenClaw from a native desktop shell — no manual wiring, no terminal required.

If you've been searching for *how to install OpenClaw on Windows*, *how to run OpenClaw locally*, or an **OpenClaw Windows installer** with a GUI, this is it.

## Quick Start

1. Download the latest installer from [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)
2. Run the Windows setup (filename follows `package.json`, e.g. `OpenClaw-Setup-0.6.2+openclaw.2026.3.31.exe`)
3. Finish the setup wizard (provider → channel → gateway)
4. Launch from Start Menu or Desktop shortcut

**System:** Windows 10/11 x64 · ~350 MB free space · Internet for API calls

## OpenClaw Desktop v0.6.2

- **Shell version:** `0.6.2+openclaw.2026.3.31` (semver + bundled OpenClaw pin in build metadata).
- **Git release tag:** `v0.6.2+openclaw.2026.3.31` — same as `package.json` `version` with a `v` prefix (OpenClaw pin visible in the tag).
- **Bundled OpenClaw (npm):** **2026.3.31** — same runtime as `npm install openclaw@2026.3.31` (current npm `latest`); pinned in [`package.json`](package.json) as `openclawBundleVersion`.
- **Desktop highlights (recent train):** **v0.6.2** adopts **Git tags that include the bundled OpenClaw version** (e.g. `v0.6.2+openclaw.2026.3.31`); see [CHANGELOG **0.6.2**](CHANGELOG.md). **v0.6.1** fixed embedded Control UI **500 / device-identity** ([**0.6.1**](CHANGELOG.md)). **v0.6.0** fixed stub `package.json` / `prepare-bundle` resync ([**0.6.0**](CHANGELOG.md)). Feishu `registerFull` guard; MiniMax **M2.7-only**; Control UI from GitHub tag sources for Electron.

### Upstream OpenClaw 2026.3.31 (summary)

Full notes: [openclaw/openclaw **v2026.3.31**](https://github.com/openclaw/openclaw/releases/tag/v2026.3.31) · [npm release digest](https://newreleases.io/project/npm/openclaw/release/2026.3.31).

**Breaking (this bump)**

- **Nodes / exec:** Remove the duplicated `nodes.run` shell wrapper; node shell execution goes through `exec host=node`; use `nodes invoke` for node-specific capabilities.
- **Plugin SDK:** Deprecate legacy provider-compat subpaths and older bundled shims; prefer documented `openclaw/plugin-sdk/*` entrypoints (warnings today; future major may remove).
- **Skills & plugin install:** Built-in dangerous-code `critical` findings and install-time scan failures **fail closed** by default; overrides such as `--dangerously-force-unsafe-install` may be required.
- **Gateway / auth:** `trusted-proxy` rejects mixed shared-token configs; local-direct fallback requires the configured token (no implicit same-host auth).
- **Gateway / node:** Node commands stay disabled until node pairing is approved; node-originated runs use a reduced trusted surface.

**Feishu-related fixes (upstream)**

- **Hooks / config:** `hooks.mappings[].channel` accepts runtime plugin ids such as `feishu` (fixes validation rejecting the Feishu channel). ([#56226](https://github.com/openclaw/openclaw/issues/56226))
- **Feishu / groups:** Quoted replies and topic bootstrap context stay aligned with group sender allowlists.

**Still in effect from earlier pins (e.g. 2026.3.28)**

- **Qwen:** `qwen-portal-auth` removed; use Model Studio / `openclaw onboard --auth-choice modelstudio-api-key`.
- **Config / Doctor:** No automatic migrations for very old keys (about two months or older); stale keys may fail validation.
- **xAI / MiniMax / CLI / Control UI / channels:** See [v2026.3.28](https://github.com/openclaw/openclaw/releases/tag/v2026.3.28) for the large 2026.3.28 train (Responses API, M2.7-only catalog, `openclaw config schema`, sensitive config UI, etc.).

**Tip (MiniMax 401):** MiniMax Anthropic-compatible endpoints expect **`x-api-key`**, not Bearer. This shell sets `authHeader: false` for MiniMax and migrates existing configs on load. Other third-party `anthropic-messages` hosts may still need `authHeader: true` where documented.

Older desktop releases are listed in [CHANGELOG.md](CHANGELOG.md).

## Compatibility with upstream OpenClaw (bundled `2026.3.31`)

Each release **pins** the bundled OpenClaw npm version in root [`package.json`](package.json) (`openclawBundleVersion`). `pnpm run download-openclaw` installs that exact version (unless you override with a CLI arg or `OPENCLAW_DESKTOP_BUNDLE_VERSION`). For local packaging, run `download-openclaw` before `prepare-bundle`. The committed [`resources/bundle-manifest.json`](resources/bundle-manifest.json) is informational only — **the bundled version is whatever `prepare-bundle` writes to `bundledOpenClawVersion`.**

- **Runtime:** Bundled portable Node.js **22.16.0** (`pnpm run download-node`), matching upstream `openclaw.mjs` / `engines` (**Node ≥ 22.16**).
- **State & config:** Same as upstream: `%USERPROFILE%\.openclaw`, main config `openclaw.json`. Use **`OPENCLAW_*`** env vars (`CLAWDBOT_*` / `MOLTBOT_*`, `.moltbot`, etc. were removed upstream).
- **Control UI:** The npm package does not ship `dist/control-ui/`; we fetch GitHub tag **`v<version>`** sources (`ui/` plus repo-root `src/`, etc.) and run Vite. CI builds static assets on Linux and merges them into the Windows installer.
- **Embedded console auth:** For **local** gateways (not `remote`), the shell auto-maintains `gateway.controlUi.allowInsecureAuth` and `dangerouslyDisableDeviceAuth` in `openclaw.json` so OpenClaw **2026.3.x** Control UI works inside the Electron iframe (see [CHANGELOG 0.6.1](CHANGELOG.md)). If you switch to remote gateway or hand-edit these keys, follow upstream docs.
- **Bundled plugin list:** Upstream ships built-in channel/provider plugins under **`dist/extensions/*`**; the desktop shell scans that path and still falls back to legacy top-level `extensions/`.
- **Breaking changes:** Plugin SDK (`openclaw/plugin-sdk/*`), browser/install behavior, and other breaking items are covered in [upstream OpenClaw releases](https://github.com/openclaw/openclaw/releases) and [upstream docs](https://docs.openclaw.ai/) for the version you ship. Installer-only users usually need no action; **custom/third-party plugin** authors should follow upstream migration guides.

*Same section in Chinese: [README.zh-CN.md](./README.zh-CN.md).*

## Features

| | |
|---|---|
| 🔽 **One-click installer** | Native Windows `.exe` installer — no `npm install` or system-wide Node.js needed |
| ⚡ **Bundled runtime** | Ships with portable Node.js + OpenClaw so first launch is instant |
| 🧙 **Guided setup wizard** | Step-by-step configuration for model provider, channel, and gateway |
| 🔄 **In-app updates** | Built-in updater via GitHub Releases; rollback to any previous version |
| 🪟 **Native Windows shell** | Start Menu, Desktop shortcut, system tray, and auto-start support |
| 🌐 **50+ providers** | OpenAI, Claude, Gemini, DeepSeek, Kuae, and more |
| 💬 **Multi-channel** | Telegram, Discord, Slack, WhatsApp, Feishu, and more |
| 🌍 **Multi-language UI** | English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français |
| 🔐 **Feishu pairing & allowlist** | Approve DM users, manage senders, add `open_id` — all inside the app |

## Ecosystem

```
         OpenClaw
             |
    ┌────────┴────────┐
    │                 │
  Desktop           GUI
    │            Plugins
Installer          ...
```

OpenClaw Desktop is a **community-maintained Windows distribution** for the OpenClaw ecosystem. Part of the OpenClaw ecosystem — not affiliated with the core project.

## Download

| | |
|---|---|
| **Release tag** | `v0.6.2+openclaw.2026.3.31` (equals `v` + `package.json` `version`) |
| **Installer** | `OpenClaw-Setup-0.6.2+openclaw.2026.3.31.exe` (see [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest) for exact asset) |
| **Platform** | Windows 10/11 x64 |
| **Includes** | Electron shell, portable Node.js, bundled OpenClaw |
| **Extras** | SHA-256 checksum, `latest.yml` for in-app updates |

**→ [github.com/agentkernel/openclaw-desktop/releases/latest](https://github.com/agentkernel/openclaw-desktop/releases/latest)**

## Screenshots

| Installer | Setup Wizard | Dashboard |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="Installer" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="Setup Wizard" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="Dashboard" width="260" /> |

## Feishu Settings & Pairing

If you use Feishu with pairing mode, Desktop keeps the whole flow inside the app:

1. Configure Feishu credentials in the wizard or in **Settings**
2. Keep DM mode on `pairing` to approve users before they can chat
3. Ask the requester to DM the bot in Feishu
4. Open **Feishu Settings** to review pending requests, approve senders, edit the allowlist, or add an `open_id` manually

If the pending list is empty but you have a pairing code, use the code-based approval path on the same screen — Desktop will call the bundled OpenClaw runtime as a fallback.

## FAQ

<details>
<summary><strong>How do I install OpenClaw on Windows?</strong></summary>

Download the latest `OpenClaw-Setup-*.exe` from the [latest release](https://github.com/agentkernel/openclaw-desktop/releases/latest) and run it. That's it — no `npm`, no system-wide Node.js, no terminal commands needed.
</details>

<details>
<summary><strong>Do I need Node.js installed globally?</strong></summary>

No. The installer ships with a portable Node.js runtime.
</details>

<details>
<summary><strong>Where is user data stored?</strong></summary>

- OpenClaw config: `%USERPROFILE%\.openclaw\openclaw.json`
- Desktop config: `%APPDATA%\OpenClaw Desktop\config.json`
- Logs: `%USERPROFILE%\.openclaw\`
- Backups: `%USERPROFILE%\.openclaw\backups\`

Uninstalling the app does not remove these by default.
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

Desktop checks GitHub Releases and can download updates through the built-in updater. You can also download any older asset manually for rollback.
</details>

<details>
<summary><strong>What does the Kuae HTTPS proxy fix do?</strong></summary>

When the bundled OpenClaw gateway inherits `HTTP(S)_PROXY`, some local proxies break TLS to Kuae's Coding Plan endpoint (`coding-plan-endpoint.kuaecloud.net`). Desktop merges `NO_PROXY` for both `.kuaecloud.net` domains so Kuae traffic goes direct while other providers still use your proxy. Set `OPENCLAW_SKIP_KUAE_NO_PROXY=1` to disable.
</details>

## Development

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

**Prerequisites:** Node.js `>= 22.16.0` · `pnpm` · Windows 10/11

**Common commands:**
```bash
pnpm type-check   # Type check
pnpm build       # Build
pnpm run package:prepare-deps   # download-node + download-openclaw (before installer)
pnpm run prepare-bundle
pnpm run package:win   # Output: dist/OpenClaw-Setup-<version>.exe
```

**Bundled OpenClaw:** Pinned in `package.json` (`openclawBundleVersion`). After `prepare-bundle`, see `bundledOpenClawVersion` in [`resources/bundle-manifest.json`](resources/bundle-manifest.json) (currently **2026.3.31** for desktop **v0.6.2**). Local checks: `pnpm run check-openclaw-versions` (omit `OPENCLAW_SKIP_NPM_LATEST_CHECK` to also compare against npm `latest`).

**Related docs:** [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[GPL-3.0](LICENSE)

---

⭐ Star History · Contributors · Community

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw Windows installer, OpenClaw desktop app,
OpenClaw setup wizard, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
