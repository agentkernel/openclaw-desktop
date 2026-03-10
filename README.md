<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>

<p align="center">
  <strong>Official-style desktop installer and distribution for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>. Part of the OpenClaw ecosystem.</strong>
</p>

<p align="center">
  ⭐ <strong>If this project helps you, please give it a star!</strong> ⭐
</p>

<p align="center">
  Run OpenClaw on Windows with a native GUI, bundled runtime, guided setup, built-in updater, and a downloadable <code>.exe</code> installer.
</p>

<p align="center">
  <img src="resources/demo.gif" alt="OpenClaw Desktop Demo running an AI agent on Windows" width="600" />
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=latest%20release" alt="Latest release"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/release.yml?style=flat-square&label=release" alt="Release workflow"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/releases"><img src="https://img.shields.io/github/downloads/agentkernel/openclaw-desktop/total?style=flat-square&color=16a34a&label=downloads" alt="Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/agentkernel/openclaw-desktop?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> •
  <a href="#download">Download</a> •
  <a href="#how-to-install-openclaw-on-windows">Why it exists</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#development">Development</a> •
  <a href="#faq">FAQ</a>
</p>

> `OpenClaw Desktop` is a Windows distribution that packages the upstream OpenClaw runtime into an easier desktop experience. Part of the broader OpenClaw ecosystem.

## Download

**Primary download:** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

- Installer filename: `OpenClaw-Setup-0.1.0.exe`
- Target platform: Windows 10/11 x64
- Includes: Electron shell, bundled Node.js runtime, bundled OpenClaw package
- Also published with: checksum file and `latest.yml` for in-app updates

## How to install OpenClaw on Windows?

`OpenClaw` is a powerful open-source AI agent project, but many users wonder **how to install OpenClaw on Windows** or **how to run OpenClaw locally** without a terminal-first setup flow. `OpenClaw Desktop` turns that into a normal desktop install experience:

- Download one installer instead of wiring everything manually
- Launch from Start Menu or Desktop shortcut
- Configure providers, channels, and gateway from a visual setup wizard
- Update from GitHub Releases without reinstalling from scratch each time

This project is the perfect OpenClaw Windows installer and GUI for your AI agents.

## Features

- Native Windows installer with Start Menu and Desktop shortcuts
- Guided setup wizard for model, channel, gateway, and API key configuration
- Bundled Node.js runtime so system-wide Node.js is not required
- Bundled OpenClaw runtime for fast first launch
- Built-in update flow based on GitHub Releases and `electron-updater`
- Update center with health checks, bundle verification, rollback guidance, and diagnostics
- System tray integration and auto-start at login
- Multi-language UI: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français
- Support for 50+ AI providers and multiple channels including Telegram, Discord, Slack, WhatsApp, and Feishu

## Quick Start

1. Download the latest installer from [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest).
2. Run `OpenClaw-Setup-0.1.0.exe`.
3. Finish the installation wizard and launch `OpenClaw Desktop`.
4. Complete the first-run setup for your model provider and gateway.
5. Start using OpenClaw from a native Windows desktop shell.

System requirements:

- Windows 10/11 x64
- Around 350 MB free disk space
- Internet connection for model API calls and update checks

## OpenClaw Ecosystem

```text
            OpenClaw
                |
    ----------------------------
    |            |            |
 Desktop        GUI        Plugins
    |
Installer
```

Related Projects:
- [openclaw](https://github.com/openclaw/openclaw)
- [openclaw-desktop](https://github.com/agentkernel/openclaw-desktop)

## Release Assets

Every release is intended to expose the Windows installer in the most obvious place for end users:

- `OpenClaw-Setup-<version>.exe`: the installer most users should download
- `OpenClaw-Setup-<version>.exe.sha256`: checksum for manual verification
- `latest.yml` or `latest-beta.yml`: metadata consumed by the in-app updater

## Architecture

```text
OpenClaw Desktop
├─ Electron main process
├─ React renderer UI
├─ Preload bridge and IPC layer
├─ Gateway process manager
├─ Update service
└─ Bundled resources
   ├─ portable Node.js runtime
   └─ bundled OpenClaw package
```

More detail:

- [Architecture notes](docs/ARCHITECTURE.md)
- [Product notes](docs/product-design.md)

## Development

Prerequisites:

- Node.js `>= 22.12.0`
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
pnpm run prepare-bundle
pnpm run package:win
```

Build output:

- `dist/OpenClaw-Setup-<version>.exe`

## Project Structure

```text
openclaw-desktop/
├─ src/
│  ├─ main/
│  ├─ preload/
│  ├─ renderer/
│  └─ shared/
├─ scripts/
├─ resources/
├─ build/
└─ .github/workflows/
```

## FAQ

<details>
<summary><strong>Is this part of the OpenClaw ecosystem?</strong></summary>

Yes, this is an official-style desktop distribution that packages upstream OpenClaw into a Windows desktop shell for an easier local setup.
</details>

<details>
<summary><strong>Do I need Node.js installed globally?</strong></summary>

No. The installer bundles a portable Node.js runtime that is shipped with the application.
</details>

<details>
<summary><strong>Where do I download the EXE?</strong></summary>

Use the latest release page: <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">github.com/agentkernel/openclaw-desktop/releases/latest</a>. The main asset is <code>OpenClaw-Setup-&lt;version&gt;.exe</code>.
</details>

<details>
<summary><strong>Where is my data stored?</strong></summary>

- OpenClaw config: `%USERPROFILE%\.openclaw\openclaw.json`
- Desktop shell config: `%APPDATA%\OpenClaw Desktop\config.json`
- Logs: `%USERPROFILE%\.openclaw\`
- Backups: `%USERPROFILE%\.openclaw\backups\`

Uninstalling the app does not delete user configuration by default.
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

The app checks GitHub Releases and can download updates through the built-in updater. Release assets also remain available for manual download and rollback.
</details>

## Community & Support

⭐ **Star History**

If this project helps you run OpenClaw, please consider giving us a star!

⭐ **Contributors**

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

⭐ **Community**

Join our Discussions to ask questions, showcase what you've built, or request new features.

## License

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->