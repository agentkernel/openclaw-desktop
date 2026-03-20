<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>

<p align="center">
  <strong>OpenClaw 官方风格的桌面安装版。OpenClaw 生态系统的组成部分。</strong>
</p>

<p align="center">
  ⭐ <strong>如果这个项目对你有帮助，请点个 Star！</strong> ⭐
</p>

<p align="center">
  通过原生 GUI、内置运行时、引导式安装向导、内置更新以及可下载的 <code>.exe</code> 安装程序，在 Windows 上轻松运行 OpenClaw。
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
  <a href="./README.md">English</a> •
  <a href="#下载">下载</a> •
  <a href="#如何在-windows-上安装-openclaw">为什么需要它</a> •
  <a href="#核心功能">核心功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#本地开发">本地开发</a> •
  <a href="#更新日志">更新日志</a> •
  <a href="#faq">FAQ</a>
</p>

> `OpenClaw Desktop` 是一个 Windows 分发版，它将上游的 OpenClaw 运行时打包成更易用的桌面体验。它是广泛的 OpenClaw 生态系统的一部分。

## 下载

**主要下载渠道：** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

- 安装包文件名：`OpenClaw-Setup-0.1.1.exe`
- 适用系统：Windows 10/11 x64
- 包含内容：Electron 外壳、内置的 Node.js 运行时、内置的 OpenClaw 包
- 同时发布：用于校验的 checksum 文件及用于应用内更新的 `latest.yml`

## 更新日志

### 0.1.1

- **OpenClaw 运行时：** 捆绑的 OpenClaw 已更新至最新版本 `2026.3.13`，桌面端已支持最新版 OpenClaw 运行时。
- **Kuae（夸娥云编程套餐）与 HTTPS 代理：** 捆绑的 OpenClaw **网关**子进程会继承系统 `HTTP(S)_PROXY`；部分本机代理会导致访问 Kuae API（`coding-plan-endpoint.kuaecloud.net`）时 TLS 失败。桌面端在启动网关时会自动**合并** `NO_PROXY` / `no_proxy`，加入 `coding-plan-endpoint.kuaecloud.net` 与 `.kuaecloud.net`，使 Kuae 相关请求**直连**，其它厂商仍按原代理设置。调试可设置环境变量 `OPENCLAW_SKIP_KUAE_NO_PROXY=1` 关闭该合并。详见 [FAQ → Kuae 与 HTTPS 代理](#faq)。
- **文档：** README 中增加上述说明（中英 FAQ / Changelog）。

### 0.1.0

- 首个公开发布轨道：Windows 安装包、引导向导、捆绑运行时与应用内更新。

## 如何在 Windows 上安装 OpenClaw？

`OpenClaw` 是一个强大的开源 AI Agent 项目，但许多用户想知道**如何在 Windows 上安装 OpenClaw** 或**如何在本地运行 OpenClaw**，而不必经历复杂的终端配置。`OpenClaw Desktop` 将其转化为普通的桌面安装体验：

很多用户会在 GitHub / Google / AI 搜索里输入：

- `how to install openclaw`
- `openclaw windows installer`
- `openclaw 桌面版`
- `openclaw windows 安装器`
- `openclaw 本地运行`

`OpenClaw Desktop` 就是为这些需求设计的：它把复杂的命令行安装过程封装成一个普通 Windows 安装向导和桌面应用。

- 无需手动配置，只需下载一个安装程序
- 可通过开始菜单或桌面快捷方式启动
- 通过可视化向导配置提供商、频道和网关
- 通过 GitHub Releases 直接更新，无需每次重新安装

本项目是为你的 AI Agent 提供的完美 OpenClaw Windows 安装器和 GUI。

## 核心功能

- 带有开始菜单和桌面快捷方式的 Windows 原生安装程序
- 引导式的模型、频道、网关及 API Key 配置向导
- 内置 Node.js 运行时，因此无需在全局安装 Node.js
- 内置 OpenClaw 运行时，首次启动极为迅速
- 基于 GitHub Releases 和 `electron-updater` 的内置更新流
- 包含健康检查、包校验、回滚指导及诊断功能的更新中心
- 系统托盘集成及登录自启动
- 多语言 UI：English, 简体中文, 繁体中文, 日本语, 한국어, Español, Français
- 支持 50 多家 AI 提供商及多种渠道（包括 Telegram、Discord、Slack、WhatsApp、飞书）

## 快速开始

1. 从 [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest) 下载最新的安装程序。
2. 运行 `OpenClaw-Setup-0.1.1.exe`。
3. 完成安装向导并启动 `OpenClaw Desktop`。
4. 完成模型提供商和网关的首次运行设置。
5. 开始从原生 Windows 桌面端使用 OpenClaw。

系统要求：

- Windows 10/11 x64
- 大约 350 MB 可用磁盘空间
- 需要网络连接以调用模型 API 并进行更新检查

## OpenClaw 生态系统

```text
            OpenClaw
                |
    ----------------------------
    |            |            |
 桌面端          GUI         插件
    |
 安装器
```

相关项目：
- [openclaw](https://github.com/openclaw/openclaw)
- [openclaw-desktop](https://github.com/agentkernel/openclaw-desktop)

## 架构

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

详细信息：

- [架构说明](docs/ARCHITECTURE.md)
- [产品说明](docs/product-design.md)

## 本地开发

前提条件：

- Node.js `>= 22.12.0`
- `pnpm`
- Windows 10/11 （用于打包和端到端验证）

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm run download-node
pnpm run download-openclaw
pnpm run prepare-bundle
pnpm run package:win
```

构建输出：

- `dist/OpenClaw-Setup-<version>.exe`

## FAQ

<details>
<summary><strong>这是 OpenClaw 生态系统的一部分吗？</strong></summary>

是的，这是一个官方风格的桌面分发版，它将上游的 OpenClaw 打包成 Windows 桌面外壳，以便于本地进行简单设置。
</details>

<details>
<summary><strong>我需要全局安装 Node.js 吗？</strong></summary>

不需要。安装程序内置了便携的 Node.js 运行时，随应用一同分发。
</details>

<details>
<summary><strong>我在哪里下载 EXE？</strong></summary>

使用最新的 release 页面：<a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">github.com/agentkernel/openclaw-desktop/releases/latest</a>。主要文件是 <code>OpenClaw-Setup-&lt;version&gt;.exe</code>。
</details>

<details>
<summary><strong>我的数据存在哪里？</strong></summary>

- OpenClaw 配置: `%USERPROFILE%\.openclaw\openclaw.json`
- 桌面外壳配置: `%APPDATA%\OpenClaw Desktop\config.json`
- 日志: `%USERPROFILE%\.openclaw\`
- 备份: `%USERPROFILE%\.openclaw\backups\`

默认情况下，卸载应用不会删除用户配置。
</details>

<details>
<summary><strong>更新机制是怎样的？</strong></summary>

该应用会检查 GitHub Releases，并通过内置的更新程序下载更新。历史发布版本也一直可用，便于手动下载和回滚。
</details>

## 社区与支持

⭐ **Star History (Star 历史)**

如果这个项目帮助你在本地运行了 OpenClaw，请考虑给我们点个 Star！

⭐ **Contributors (贡献者)**

欢迎贡献代码。在提交 PR 之前，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

⭐ **Community (社区)**

欢迎加入我们的 Discussions，提问交流、展示你的作品或请求新功能。

## 关键词 / Keywords

OpenClaw Desktop · OpenClaw Windows · OpenClaw installer · OpenClaw Windows 安装器 · OpenClaw 桌面版 ·
OpenClaw GUI · how to install openclaw · openclaw windows installer · openclaw 本地运行 · OpenClaw 安装教程

## 许可证

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->