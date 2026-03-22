<p align="center">
  <strong>Language / 语言:</strong>
  <strong>English</strong>
  |
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>

<p align="center">
  <strong>Community-maintained Windows desktop app and installer for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.</strong><br />
  Native GUI, bundled runtime, guided setup wizard, and in-app updates for running OpenClaw on Windows.
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=latest%20release" alt="Latest release"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/release.yml?style=flat-square&label=release" alt="Release workflow"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/releases"><img src="https://img.shields.io/github/downloads/agentkernel/openclaw-desktop/total?style=flat-square&color=16a34a&label=downloads" alt="Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/agentkernel/openclaw-desktop?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#whats-new-in-v011">What's New</a> •
  <a href="#download">Download</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#feishu-settings--pairing">Feishu</a> •
  <a href="#development">Development</a> •
  <a href="#faq">FAQ</a>
</p>

<p align="center">
  <img src="resources/demo.gif" alt="OpenClaw Desktop Demo running an AI agent on Windows" width="720" />
</p>

## Overview

`OpenClaw Desktop` packages the OpenClaw runtime into a normal Windows install experience. You download one `.exe`, finish a setup wizard, configure your provider and channel, and run OpenClaw from a native desktop shell instead of wiring everything by hand.

It is designed for users who want:

- A Windows-first installer and GUI for OpenClaw
- Bundled Node.js and bundled OpenClaw runtime
- Guided provider, channel, and gateway setup
- Built-in update flow from GitHub Releases
- Desktop-native Feishu pairing and allowlist management

## What's New In v0.1.1

- **Feishu Settings:** Feishu credentials, DM pairing, and allowlist management now live inside the desktop app. Open **Feishu Settings** from **Settings**, the **Dashboard**, or the **tray menu**.
- **Desktop approval flow:** Pending Feishu requests can be approved directly in the app. If you only have a pairing code, Desktop falls back to the bundled OpenClaw runtime for approval.
- **Bundled runtime update:** Bundled OpenClaw is updated to `2026.3.13`.
- **Kuae proxy fix:** When the gateway inherits `HTTP(S)_PROXY`, Desktop now merges `NO_PROXY` / `no_proxy` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` so Kuae traffic can bypass problematic HTTPS proxies.

More history: [CHANGELOG.md](CHANGELOG.md)

## Download

Primary download: [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

- Current desktop release: `v0.1.1`
- Main installer: `OpenClaw-Setup-0.1.1.exe`
- Platform: Windows 10/11 x64
- Includes: Electron shell, bundled Node.js runtime, bundled OpenClaw package
- Extra assets: checksum files and `latest.yml` for in-app updates

## Screenshots

| Installer | Setup Wizard | Dashboard |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="OpenClaw Desktop Windows installer user scope options" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="OpenClaw Desktop first-run setup wizard on Windows" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="OpenClaw Control gateway dashboard running on Windows" width="260" /> |

## Quick Start

1. Download the latest installer from [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest).
2. Run `OpenClaw-Setup-0.1.1.exe`.
3. Finish the installer and launch `OpenClaw Desktop`.
4. Complete the first-run setup for your model provider, channel, and gateway.
5. Start using OpenClaw from the desktop shell.

System requirements:

- Windows 10/11 x64
- About 350 MB free disk space
- Internet connection for provider API calls and update checks

## Features

- Native Windows installer with Start Menu and Desktop shortcuts
- Guided setup wizard for model, channel, gateway, and API key configuration
- Bundled Node.js runtime so no system-wide Node.js install is required
- Bundled OpenClaw runtime for a faster first launch
- Built-in updater powered by GitHub Releases and `electron-updater`
- Update center with health checks, bundle verification, rollback guidance, and diagnostics
- Tray integration and auto-start support
- Multi-language UI: English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Spanish, French
- Support for 50+ AI providers and multiple channels including Telegram, Discord, Slack, WhatsApp, and Feishu

## Feishu Settings & Pairing

Desktop keeps the Feishu DM flow practical for first-time setup:

1. Configure Feishu credentials in the setup flow or in **Settings**.
2. Keep DM mode on `pairing` if you want approval before users can chat.
3. Ask the requester to DM the bot in Feishu.
4. Open **Feishu Settings** to review pending requests, approve a sender, edit the allowlist, or add an `open_id` manually.

If the pending list is empty but you already received a pairing code in Feishu, use the code-based approval path on the same screen. Desktop will use the bundled runtime as a fallback for that case.

## Development

Prerequisites:

- Node.js `>= 22.16.0`
- `pnpm`
- Windows 10/11 for packaging and end-to-end validation

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

Useful commands:

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

Build output:

- `dist/OpenClaw-Setup-<version>.exe`

Related docs:

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

Use the latest release page: <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">github.com/agentkernel/openclaw-desktop/releases/latest</a>. The main asset is <code>OpenClaw-Setup-&lt;version&gt;.exe</code>.
</details>

<details>
<summary><strong>Where is user data stored?</strong></summary>

- OpenClaw config: <code>%USERPROFILE%\.openclaw\openclaw.json</code>
- Desktop config: <code>%APPDATA%\OpenClaw Desktop\config.json</code>
- Logs: <code>%USERPROFILE%\.openclaw\</code>
- Backups: <code>%USERPROFILE%\.openclaw\backups\</code>

Uninstalling the app does not remove user configuration by default.
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

Desktop checks GitHub Releases and can download updates through the built-in updater. You can also download older assets manually for rollback.
</details>

<details>
<summary><strong>What does the Kuae HTTPS proxy fix do?</strong></summary>

When the bundled OpenClaw gateway inherits <code>HTTP(S)_PROXY</code>, some local proxies break TLS to Kuae's Coding Plan endpoint. Desktop therefore merges <code>NO_PROXY</code> / <code>no_proxy</code> for <code>coding-plan-endpoint.kuaecloud.net</code> and <code>.kuaecloud.net</code> so Kuae traffic can go direct while other traffic still uses your proxy.

To disable this behavior for debugging, set <code>OPENCLAW_SKIP_KUAE_NO_PROXY=1</code> before starting the app.
</details>

## License

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
