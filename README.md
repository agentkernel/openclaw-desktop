<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>

<p align="center">
  Community-maintained Windows desktop app and installer for
  <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.<br />
  Native GUI, bundled runtime, guided setup wizard, and in-app updates —
  everything you need to run OpenClaw on Windows.
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=latest+release" alt="Latest release" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/release.yml?style=flat-square&label=release" alt="Release workflow" />
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

---

**Language:** English · [简体中文](./README.zh-CN.md)

---

## Overview

`OpenClaw Desktop` packages the OpenClaw runtime into a normal Windows install experience. Download one `.exe`, finish a setup wizard, configure your provider and channel, and run OpenClaw from a native desktop shell — no manual wiring required.

Built for users who want:

- A Windows-first installer and GUI for OpenClaw
- Bundled Node.js and OpenClaw runtime (no global install needed)
- Guided provider, channel, and gateway setup
- Built-in updates via GitHub Releases
- Desktop-native Feishu pairing and allowlist management

## What's New in v0.1.1

- **Feishu Settings** — Feishu credentials, DM pairing, and allowlist are now managed inside the app. Open it from **Settings**, the **Dashboard**, or the **tray menu**.
- **Desktop approval flow** — Pending Feishu requests are approved directly in the app. When only a pairing code is available, Desktop falls back to the bundled OpenClaw runtime.
- **Runtime update** — Bundled OpenClaw updated to `2026.3.13`.
- **Kuae proxy fix** — When the gateway inherits `HTTP(S)_PROXY`, Desktop now merges `NO_PROXY` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` so Kuae traffic bypasses HTTPS proxies that break TLS.

Full history: [CHANGELOG.md](CHANGELOG.md)

## Download

**Primary download:** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

| Item | Value |
| --- | --- |
| Release | `v0.1.1` |
| Installer | `OpenClaw-Setup-0.1.1.exe` |
| Platform | Windows 10/11 x64 |
| Includes | Electron shell, bundled Node.js, bundled OpenClaw |
| Extras | SHA-256 checksum, `latest.yml` for in-app updates |

## Screenshots

| Installer | Setup Wizard | Dashboard |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="Installer" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="Setup Wizard" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="Dashboard" width="260" /> |

## Quick Start

1. Download the latest installer from [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest).
2. Run `OpenClaw-Setup-0.1.1.exe`.
3. Finish the installer and launch `OpenClaw Desktop`.
4. Complete the first-run setup for your model provider, channel, and gateway.
5. Start using OpenClaw from the desktop shell.

**System requirements:** Windows 10/11 x64 · ~350 MB free disk space · Internet connection for API calls and update checks

## Features

- Native Windows installer with Start Menu and Desktop shortcuts
- Guided setup wizard for model, channel, gateway, and API key configuration
- Bundled Node.js runtime (no system-wide install required)
- Bundled OpenClaw runtime for faster first launch
- Built-in updater powered by GitHub Releases and `electron-updater`
- Update center with health checks, bundle verification, rollback guidance, and diagnostics
- System tray integration and auto-start support
- Multi-language UI: English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Spanish, French
- 50+ AI providers and multiple channels: Telegram, Discord, Slack, WhatsApp, Feishu, and more

## Feishu Settings & Pairing

Desktop streamlines the Feishu DM pairing flow:

1. Configure Feishu credentials in the setup wizard or in **Settings**.
2. Keep DM mode on `pairing` if you want to approve users before they can chat.
3. Ask the requester to DM the bot in Feishu.
4. Open **Feishu Settings** to review pending requests, approve a sender, edit the allowlist, or add an `open_id` manually.

If the pending list is empty but you already received a pairing code in Feishu, use the code-based approval path on the same screen — Desktop will use the bundled runtime as a fallback.

## Development

**Prerequisites:** Node.js `>= 22.16.0` · `pnpm` · Windows 10/11

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

**Common commands:**

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm run download-node
pnpm run download-openclaw
pnpm run verify-bundle
pnpm run prepare-bundle
pnpm run package:win
```

Build output: `dist/OpenClaw-Setup-<version>.exe`

**Related docs:**

- [CHANGELOG.md](CHANGELOG.md)
- [docs/product-design.md](docs/product-design.md)
- [docs/feishu-pairing-ux-plan.md](docs/feishu-pairing-ux-plan.md)
- [docs/powershell-setup.md](docs/powershell-setup.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## FAQ

<details>
<summary><strong>Do I need Node.js installed globally?</strong></summary>

No. The installer ships with a portable Node.js runtime.
</details>

<details>
<summary><strong>Where do I download the installer?</strong></summary>

Use the latest release page: [github.com/agentkernel/openclaw-desktop/releases/latest](https://github.com/agentkernel/openclaw-desktop/releases/latest). The main asset is `OpenClaw-Setup-<version>.exe`.
</details>

<details>
<summary><strong>Where is user data stored?</strong></summary>

- OpenClaw config: `%USERPROFILE%\.openclaw\openclaw.json`
- Desktop config: `%APPDATA%\OpenClaw Desktop\config.json`
- Logs: `%USERPROFILE%\.openclaw\`
- Backups: `%USERPROFILE%\.openclaw\backups\`

Uninstalling the app does not remove user configuration by default.
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

Desktop checks GitHub Releases and can download updates through the built-in updater. You can also download older assets manually for rollback.
</details>

<details>
<summary><strong>What does the Kuae HTTPS proxy fix do?</strong></summary>

When the bundled OpenClaw gateway inherits `HTTP(S)_PROXY`, some local proxies break TLS to Kuae's Coding Plan endpoint. Desktop merges `NO_PROXY` / `no_proxy` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` so Kuae traffic goes direct while other traffic still uses your proxy.

To disable this behavior for debugging, set `OPENCLAW_SKIP_KUAE_NO_PROXY=1` before starting the app.
</details>

## License

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
