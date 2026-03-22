<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>

<p align="center">
  面向 Windows 的 OpenClaw 桌面应用与安装器，由社区维护。<br />
  原生 GUI、内置运行时、引导式设置向导和应用内更新 —
  在 Windows 上运行 OpenClaw 所需的一切，都在这里。
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC" alt="最新版本" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/release.yml?style=flat-square&label=%E5%8F%91%E5%B8%83%E6%B5%81%E7%A8%8B" alt="发版流程" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/releases">
    <img src="https://img.shields.io/github/downloads/agentkernel/openclaw-desktop/total?style=flat-square&color=16a34a&label=%E4%B8%8B%E8%BD%BD%E6%AC%A1%E6%95%B0" alt="下载量" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/agentkernel/openclaw-desktop?style=flat-square" alt="许可证" />
  </a>
</p>

<p align="center">
  <img src="resources/demo.gif" alt="OpenClaw Desktop 运行演示（Windows）" width="720" />
</p>

---

**语言：** [English](./README.md) · 简体中文

---

## 项目简介

`OpenClaw Desktop` 把 OpenClaw 的运行环境封装成标准的 Windows 安装体验。只需下载一个 `.exe`，完成设置向导，就可以从原生桌面应用运行 OpenClaw，无需手动配置一切。

适合以下需求：

- 希望在 Windows 上通过安装器和 GUI 快速运行 OpenClaw
- 使用内置 Node.js 和 OpenClaw 运行时（无需全局安装）
- 需要可视化配置模型、频道和网关
- 通过 GitHub Releases 做应用内更新
- 在桌面端管理飞书配对和放行名单

## v0.1.1 更新亮点

- **飞书设置** — 飞书凭证、DM 配对和 allowlist 现已在桌面端统一管理。可从 **设置**、**控制台** 或 **托盘菜单** 进入。
- **桌面端审批流程** — 待处理的飞书配对请求可直接在应用内批准。若仅有配对码，桌面端会回退到内置 OpenClaw 运行时完成审批。
- **运行时更新** — 捆绑的 OpenClaw 已更新至 `2026.3.13`。
- **Kuae 代理修复** — 当网关继承 `HTTP(S)_PROXY` 时，桌面端会为 `coding-plan-endpoint.kuaecloud.net` 和 `.kuaecloud.net` 自动合并 `NO_PROXY`，让 Kuae 流量绕过会导致 TLS 失败的 HTTPS 代理。

完整历史记录：[CHANGELOG.md](CHANGELOG.md)

## 下载

**主要下载渠道：** [GitHub Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest)

| 项目 | 值 |
| --- | --- |
| 当前版本 | `v0.1.1` |
| 安装包 | `OpenClaw-Setup-0.1.1.exe` |
| 适用系统 | Windows 10/11 x64 |
| 包含内容 | Electron 外壳、内置 Node.js、内置 OpenClaw |
| 附加产物 | SHA-256 校验文件、`latest.yml`（应用内更新用） |

## 界面预览

| 安装器 | 设置向导 | 控制台 |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="安装器" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="设置向导" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="控制台" width="260" /> |

## 快速开始

1. 从 [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest) 下载最新安装包。
2. 运行 `OpenClaw-Setup-0.1.1.exe`。
3. 完成安装向导并启动 `OpenClaw Desktop`。
4. 按首次运行向导完成模型提供商、频道和网关配置。
5. 开始在桌面端使用 OpenClaw。

**系统要求：** Windows 10/11 x64 · 约 350 MB 可用磁盘空间 · 网络连接（用于 API 调用和更新检查）

## 核心功能

- 原生 Windows 安装器，支持开始菜单和桌面快捷方式
- 引导式设置向导，可配置模型、频道、网关和 API Key
- 内置 Node.js 运行时，无需系统级安装
- 内置 OpenClaw 运行时，首次启动更快速
- 基于 GitHub Releases 和 `electron-updater` 的应用内更新
- 更新中心含健康检查、包校验、回滚指引和诊断信息
- 系统托盘集成和开机自启动支持
- 多语言 UI：English、简体中文、繁体中文、日语、韩语、西班牙语、法语
- 支持 50+ AI 提供商和多渠道：Telegram、Discord、Slack、WhatsApp、飞书等

## 飞书设置与配对

桌面端将飞书私聊配对流程收敛到一个易用的界面：

1. 在首次设置或 **设置** 中填写飞书凭证。
2. 若希望先审批再对话，保持 DM 模式为 `pairing`。
3. 让请求者在飞书中给机器人发私信。
4. 打开 **飞书设置** 查看待审批请求、批准发送者、编辑 allowlist 或手动添加 `open_id`。

若待审批列表为空但已在飞书收到配对码，可使用同一页面的"配对码审批"路径——此时桌面端会回退到内置运行时处理。

## 本地开发

**前提条件：** Node.js `>= 22.16.0` · `pnpm` · Windows 10/11

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

**常用命令：**

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

构建产物：`dist/OpenClaw-Setup-<version>.exe`

**相关文档：**

- [CHANGELOG.md](CHANGELOG.md)
- [docs/product-design.md](docs/product-design.md)
- [docs/feishu-pairing-ux-plan.md](docs/feishu-pairing-ux-plan.md)
- [docs/powershell-setup.md](docs/powershell-setup.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## FAQ

<details>
<summary><strong>需要全局安装 Node.js 吗？</strong></summary>

不需要。安装器会随应用一起提供便携版 Node.js 运行时。
</details>

<details>
<summary><strong>安装包在哪里下载？</strong></summary>

请访问最新发布页：[github.com/agentkernel/openclaw-desktop/releases/latest](https://github.com/agentkernel/openclaw-desktop/releases/latest)。主文件为 `OpenClaw-Setup-<version>.exe`。
</details>

<details>
<summary><strong>用户数据存放在哪里？</strong></summary>

- OpenClaw 配置：`%USERPROFILE%\.openclaw\openclaw.json`
- 桌面端配置：`%APPDATA%\OpenClaw Desktop\config.json`
- 日志：`%USERPROFILE%\.openclaw\`
- 备份：`%USERPROFILE%\.openclaw\backups\`

默认情况下，卸载应用不会删除这些用户配置。
</details>

<details>
<summary><strong>应用更新是怎么工作的？</strong></summary>

桌面端会检查 GitHub Releases 并通过内置更新器下载新版本。如需回滚，也可手动下载历史发布资产。
</details>

<details>
<summary><strong>Kuae HTTPS 代理修复具体做了什么？</strong></summary>

当捆绑的 OpenClaw 网关继承 `HTTP(S)_PROXY` 时，部分本地代理会导致访问 Kuae Coding Plan 接口时 TLS 失败。桌面端因此会为 `coding-plan-endpoint.kuaecloud.net` 和 `.kuaecloud.net` 自动合并 `NO_PROXY` / `no_proxy`，让 Kuae 请求直连，其他流量继续走代理。

如需调试此行为，可在启动应用前设置 `OPENCLAW_SKIP_KUAE_NO_PROXY=1`。
</details>

## 许可证

[GPL-3.0](LICENSE)

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw desktop app, OpenClaw setup wizard,
OpenClaw Windows installer, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
