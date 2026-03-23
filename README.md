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
2. Run `OpenClaw-Setup-0.2.1.exe`
3. Finish the setup wizard (provider → channel → gateway)
4. Launch from Start Menu or Desktop shortcut

**System:** Windows 10/11 x64 · ~350 MB free space · Internet for API calls

## What's New in v0.2.1

- **Bundled OpenClaw runtime** — updated to `2026.3.22` (npm latest) for the packaged Windows app and installer.

Earlier highlights (v0.2.0): Feishu Access hub, localized tray, i18n, installer license pages, shell UX refinements — see [CHANGELOG.md](CHANGELOG.md).

Earlier highlights (v0.1.1): Feishu settings entry points, desktop pairing approval, bundled OpenClaw `2026.3.13`, Kuae `NO_PROXY` merge — see [CHANGELOG.md](CHANGELOG.md).

Full changelog: [CHANGELOG.md](CHANGELOG.md)

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
| **Release** | `v0.2.1` |
| **Installer** | `OpenClaw-Setup-0.2.1.exe` |
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

Download `OpenClaw-Setup-0.2.1.exe` from the [latest release](https://github.com/agentkernel/openclaw-desktop/releases/latest) and run it. That's it — no `npm`, no system-wide Node.js, no terminal commands needed.
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
pnpm run download-node
pnpm run download-openclaw
pnpm run prepare-bundle
pnpm run package:win   # Output: dist/OpenClaw-Setup-<version>.exe
```

**Related docs:** [CHANGELOG.md](CHANGELOG.md) · [docs/product-design.md](docs/product-design.md) · [docs/feishu-pairing-ux-plan.md](docs/feishu-pairing-ux-plan.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[GPL-3.0](LICENSE)

---

⭐ Star History · Contributors · Community

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw Windows installer, OpenClaw desktop app,
OpenClaw setup wizard, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
