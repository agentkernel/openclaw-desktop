<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop – Windows Installer &amp; Native Desktop App for OpenClaw AI Agents</h1>

<p align="center">
  <strong>Official-style desktop installer &amp; Windows distribution for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>. Part of the OpenClaw ecosystem.</strong><br />
  <strong>OpenClaw 小龙虾官方桌面版一键安装部署 EXE 程序。</strong>
</p>

<p align="center">
  This project provides a one-click desktop installer for OpenClaw on Windows, packaging the official OpenClaw runtime with a native desktop experience.
</p>

<p align="center">
  ⭐ <strong>If this project helps you, please give it a star!</strong> ⭐<br />
  ⭐ <strong>如果这个项目对你有帮助，请点一个 Star 让更多人看到！</strong> ⭐
</p>

<p align="center">
  Run OpenClaw on Windows with a native GUI, bundled runtime, guided setup wizard, built‑in updater, and a downloadable <code>.exe</code> installer.<br />
  在 Windows 上通过原生桌面 GUI、内置运行时、引导式安装向导和可下载的 <code>.exe</code> 安装程序，一键运行 OpenClaw。
</p>

<p align="center">
  <img src="resources/demo.gif" alt="OpenClaw Desktop Demo running an AI agent on Windows" width="600" />
</p>

<p align="center">
  <img src="resources/screenshot-installer-user-scope.png" alt="OpenClaw Desktop Windows installer user scope options" width="420" />
</p>

<p align="center">
  <img src="resources/screenshot-setup-wizard.png" alt="OpenClaw Desktop first-run setup wizard on Windows" width="640" />
</p>

<p align="center">
  <img src="resources/screenshot-gateway-dashboard.png" alt="OpenClaw Control gateway dashboard running on Windows" width="640" />
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=latest%20release" alt="Latest release"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/release.yml?style=flat-square&label=release" alt="Release workflow"></a>
  <a href="https://github.com/agentkernel/openclaw-desktop/releases"><img src="https://img.shields.io/github/downloads/agentkernel/openclaw-desktop/total?style=flat-square&color=16a34a&label=downloads" alt="Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/agentkernel/openclaw-desktop?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文 / Chinese</a> •
  <a href="#download">Download</a> •
  <a href="#how-to-install-openclaw-on-windows">Why it exists</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#development">Development</a> •
  <a href="#changelog">Changelog</a> •
  <a href="#faq">FAQ</a>
</p>

> `OpenClaw Desktop` is a Windows distribution that packages the upstream OpenClaw runtime into an easier desktop experience. Part of the broader OpenClaw ecosystem.

## Download

**Primary download:** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)  
**主要下载渠道：** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

- Installer filename / 安装包文件名: `OpenClaw-Setup-0.1.1.exe`
- Target platform / 适用系统: Windows 10/11 x64
- Includes / 包含内容: Electron shell, bundled Node.js runtime, bundled OpenClaw package
- Also published / 同时发布: checksum file and `latest.yml` for in-app updates

## Changelog

### 0.1.1

- **OpenClaw runtime:** Bundled OpenClaw has been updated to the latest version `2026.3.13`, and the desktop app now supports the latest OpenClaw runtime.
- **Kuae (夸娥云 Coding Plan) & HTTPS proxy:** When the bundled OpenClaw **gateway** child process inherits system `HTTP(S)_PROXY`, some local proxies break TLS to Kuae’s API (`coding-plan-endpoint.kuaecloud.net`). The desktop app now **merges** `NO_PROXY` / `no_proxy` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` on gateway spawn so Kuae traffic can go **direct** while other providers still follow your proxy settings. Set `OPENCLAW_SKIP_KUAE_NO_PROXY=1` to disable this merge. See [FAQ → Kuae and HTTPS proxy](#faq).
- **文档 / Docs:** README FAQ entry for the above behavior (English + 简体中文).

### 0.1.0

- Initial public release track with Windows installer, setup wizard, bundled runtime, and updater.

## How to install OpenClaw on Windows?

`OpenClaw` is a powerful open-source AI agent project, but many users wonder **how to install OpenClaw on Windows**, **how to run OpenClaw locally**, or **how to get an OpenClaw Windows installer** without a terminal‑only setup flow.

`OpenClaw Desktop` turns that into a normal desktop install experience:

- Download one installer instead of wiring everything manually
- Launch from Start Menu or Desktop shortcut
- Configure providers, channels, and gateway from a visual setup wizard
- Update from GitHub Releases without reinstalling from scratch each time

This project is the ideal **OpenClaw Windows installer**, **OpenClaw desktop app**, and **OpenClaw GUI** for your AI agents.

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
2. Run `OpenClaw-Setup-0.1.1.exe`.
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

Windows 安装包使用 NSIS；仓库根目录下的 `build/installer.nsh` 为自定义脚本（由 `electron-builder` 引用），**需保留并提交**，勿删除（`.gitignore` 已对该文件单独放行）。

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

<details>
<summary><strong>Kuae (夸娥云) and HTTPS proxy on Windows</strong></summary>

The bundled OpenClaw **gateway** runs as a child process that inherits `HTTP(S)_PROXY`. Some local proxies break TLS to Kuae’s Coding Plan endpoint. The desktop app therefore **merges** `NO_PROXY` / `no_proxy` for `coding-plan-endpoint.kuaecloud.net` and `.kuaecloud.net` when spawning the gateway, so Kuae traffic goes **direct** while other URLs can still use the proxy.

To disable this merge (e.g. debugging), set environment variable `OPENCLAW_SKIP_KUAE_NO_PROXY=1` before starting OpenClaw Desktop.

捆绑的 OpenClaw **网关** 以子进程运行并继承系统 `HTTP(S)_PROXY`。部分本机代理会导致访问 Kuae API 时 TLS 失败；桌面端在启动网关时会自动合并 `NO_PROXY`，使 Kuae 域名直连，其它请求仍可走代理。调试可设 `OPENCLAW_SKIP_KUAE_NO_PROXY=1` 关闭该行为。
</details>

## Community & Support

⭐ **Star History**

If this project helps you run OpenClaw, please consider giving us a star!

⭐ **Contributors**

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

⭐ **Community**

Join our Discussions to ask questions, showcase what you've built, or request new features.

## Keywords / 搜索关键词

OpenClaw Desktop · OpenClaw Windows · OpenClaw installer · OpenClaw Windows installer · OpenClaw desktop app ·
OpenClaw GUI · how to install OpenClaw on Windows · run OpenClaw locally · OpenClaw 桌面版 · OpenClaw Windows 安装器 ·
OpenClaw 安装教程

## License

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->