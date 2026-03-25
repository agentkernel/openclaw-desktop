<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop</h1>
<p align="center">龙虾智能体官方中文桌面版一键安装部署EXE程序</p>

<p align="center">
  <strong>面向 Windows 的 OpenClaw 官方风格安装器与桌面应用。</strong><br />
  一键安装、内置运行时、引导式设置 — 无需接触终端，即可在 Windows 上运行 OpenClaw AI Agent。
</p>

<p align="center">
  <a href="https://github.com/agentkernel/openclaw-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/agentkernel/openclaw-desktop?style=flat-square&color=2563eb&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC" alt="最新版本" />
  </a>
  <a href="https://github.com/agentkernel/openclaw-desktop/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/agentkernel/openclaw-desktop/ci.yml?style=flat-square&label=ci" alt="CI" />
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

<p align="center">
  ⭐ &nbsp;如果这个项目对你有帮助，<strong>请点一个 Star</strong> — 只需 2 秒，但对我们意义重大！&nbsp; ⭐
</p>

---

**语言：** [English](./README.md) · 简体中文

---

## 这是什么？

**OpenClaw Desktop** 把 OpenClaw 的运行环境封装成标准的 Windows 安装体验。下载一个 `.exe`，完成设置向导，即可从原生桌面应用运行 OpenClaw，无需手动配置，无需接触终端。

如果你在搜索 **OpenClaw Windows 安装器**、**如何在 Windows 上运行 OpenClaw**，或者找 **OpenClaw 桌面版**，就是这个项目。

## 快速开始

1. 从 [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest) 下载最新安装包
2. 运行 `OpenClaw-Setup-0.3.0.exe`
3. 完成设置向导（模型提供商 → 频道 → 网关）
4. 从开始菜单或桌面快捷方式启动

**系统要求：** Windows 10/11 x64 · 约 350 MB 可用空间 · 网络连接（用于 API 调用）

## v0.3.0 更新亮点

- **内嵌 Control UI：** 壳在挂载网关控制台 iframe 之前会等待 WebSocket **操作员**握手完成，在会话真正就绪前保持「网关启动中」加载态，避免短暂出现配置网关密钥等中间页。

更早版本（v0.2.22）要点：Lit + Electron 下 Control UI 构建补丁 — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.2.21）要点：esbuild 后处理 Control UI、稳定通道 `latest.yml` — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.2.20）要点：Electron 41、网关 CSP 仅作用于文档帧 — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.2.18）要点：固定 OpenClaw 文档与 Release CI `OPENCLAW_SKIP_NPM_LATEST_CHECK` — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.2.17）要点：固定 bundle 字段、`verify-packaged-win` — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.2.0）要点：飞书访问（Feishu Access）、托盘多语言、国际化、安装器许可页、界面体验优化 — 详见 [CHANGELOG.md](CHANGELOG.md)。

更早版本（v0.1.1）要点：飞书设置入口、桌面端配对审批、捆绑 OpenClaw `2026.3.13`、Kuae `NO_PROXY` 合并 — 详见 [CHANGELOG.md](CHANGELOG.md)。

完整更新记录：[CHANGELOG.md](CHANGELOG.md)

## 与上游 OpenClaw 的兼容性（捆绑 `2026.3.23-2`）

每个桌面发行版在根目录 [`package.json`](package.json) 中用 **`openclawBundleVersion` 钉死**要捆绑的 OpenClaw npm 版本。`pnpm run download-openclaw` 会安装该版本（除非用命令行参数或 `OPENCLAW_DESKTOP_BUNDLE_VERSION` 覆盖）。本地打包前也应先执行 `download-openclaw` 再 `prepare-bundle`。仓库中的 [`resources/bundle-manifest.json`](resources/bundle-manifest.json) 仅作参考，**实际捆绑版本以 `prepare-bundle` 写入的 `bundledOpenClawVersion` 为准**。

- **运行环境**：捆绑便携 Node.js **22.16.0**（见 `pnpm run download-node`），满足上游 `openclaw.mjs` 与 `engines` 对 Node **≥22.16** 的要求。
- **状态与配置**：与上游一致使用 `%USERPROFILE%\.openclaw`、主配置 `openclaw.json`，环境变量请使用 **`OPENCLAW_*`**（`CLAWDBOT_*` / `MOLTBOT_*`、`.moltbot` 等旧名已在上游移除）。
- **Control UI**：npm 包不再附带 `dist/control-ui/`，构建时从 **GitHub 标签 `v<版本号>`** 拉取 `ui/` + 仓库根 `src/` 等源码后执行 Vite；CI 在 Linux 构建静态资源再合并到 Windows 安装包。
- **内置插件列表**：上游将内置频道/提供商插件放在 **`dist/extensions/*`**；壳内扩展扫描已同时支持该路径与旧版顶层 `extensions/`。
- **重大变更说明**：插件 SDK（`openclaw/plugin-sdk/*`）、浏览器/安装行为等 Breaking 变更以 [上游 OpenClaw Releases](https://github.com/openclaw/openclaw/releases) 与 [上游文档](https://docs.openclaw.ai/) 中**对应版本**为准；仅使用安装包与向导的用户一般无需额外操作，**自研/第三方插件**作者需按上游迁移指引更新。

*英文版同节：[README.md](./README.md)。*

## 核心功能

| | |
|---|---|
| 🔽 **一键安装** | 原生 Windows `.exe` 安装程序 — 无需 `npm install`，也无需系统级 Node.js |
| ⚡ **内置运行时** | 随安装包提供便携 Node.js + OpenClaw，首次启动即可使用 |
| 🧙 **引导式设置向导** | 逐步引导配置模型提供商、频道和网关 |
| 🔄 **应用内更新** | 通过 GitHub Releases 实现内置更新；可回滚至任意历史版本 |
| 🪟 **原生 Windows 体验** | 开始菜单、桌面快捷方式、系统托盘、开机自启动 |
| 🌐 **50+ AI 提供商** | OpenAI、Claude、Gemini、DeepSeek、Kuae 等 |
| 💬 **多渠道支持** | Telegram、Discord、Slack、WhatsApp、飞书等 |
| 🌍 **多语言 UI** | English、简体中文、繁體中文、日本語、한국어、Español、Français |
| 🔐 **飞书配对与放行** | 在应用内批准用户、管理放行名单、添加 `open_id` |

## 生态定位

```
         OpenClaw
             │
    ┌────────┴────────┐
    │                 │
  Desktop           GUI
    │            Plugins
Installer          ...
```

OpenClaw Desktop 是 OpenClaw 生态的**社区维护 Windows 分发版**，属于 OpenClaw 生态的一部分，非核心项目附属机构。

## 下载

| | |
|---|---|
| **当前版本** | `v0.3.0` |
| **安装包** | `OpenClaw-Setup-0.3.0.exe` |
| **适用系统** | Windows 10/11 x64 |
| **包含内容** | Electron 外壳、便携 Node.js、捆绑 OpenClaw |
| **附加产物** | SHA-256 校验文件、`latest.yml`（应用内更新用） |

**→ [github.com/agentkernel/openclaw-desktop/releases/latest](https://github.com/agentkernel/openclaw-desktop/releases/latest)**

## 界面预览

| 安装器 | 设置向导 | 控制台 |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="安装器" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="设置向导" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="控制台" width="260" /> |

## 飞书设置与配对

如果使用飞书配对模式，桌面端将整个流程收敛到应用内：

1. 在设置向导或**设置**中填写飞书凭证
2. 若希望先审批再对话，将 DM 模式保持为 `pairing`
3. 让请求者在飞书中给机器人发私信
4. 打开**飞书设置**查看待审批请求、批准发送者、编辑放行名单或手动添加 `open_id`

若待审批列表为空但已收到配对码，使用同一页面的"配对码审批"路径 — 桌面端将调用内置 OpenClaw 运行时作为兜底。

## 常见问题

<details>
<summary><strong>如何在 Windows 上安装 OpenClaw？</strong></summary>

从[最新发布页](https://github.com/agentkernel/openclaw-desktop/releases/latest)下载 `OpenClaw-Setup-0.3.0.exe` 并运行即可。无需 `npm`、无需系统级 Node.js、无需输入任何终端命令。
</details>

<details>
<summary><strong>需要全局安装 Node.js 吗？</strong></summary>

不需要。安装器会随应用一起提供便携版 Node.js 运行时。
</details>

<details>
<summary><strong>用户数据存在哪里？</strong></summary>

- OpenClaw 配置：`%USERPROFILE%\.openclaw\openclaw.json`
- 桌面端配置：`%APPDATA%\OpenClaw Desktop\config.json`
- 日志：`%USERPROFILE%\.openclaw\`
- 备份：`%USERPROFILE%\.openclaw\backups\`

默认情况下卸载应用不会删除这些数据。
</details>

<details>
<summary><strong>更新是如何工作的？</strong></summary>

桌面端会检查 GitHub Releases 并通过内置更新器下载新版本。如需回滚，也可手动下载任意历史发布资产。
</details>

<details>
<summary><strong>Kuae HTTPS 代理修复做了什么？</strong></summary>

当捆绑的 OpenClaw 网关继承 `HTTP(S)_PROXY` 时，部分本地代理会导致访问 Kuae Coding Plan 端点（`coding-plan-endpoint.kuaecloud.net`）时 TLS 失败。桌面端自动为 `.kuaecloud.net` 域名合并 `NO_PROXY`，使 Kuae 请求直连，其他提供商流量继续走代理。设置 `OPENCLAW_SKIP_KUAE_NO_PROXY=1` 可禁用此行为。
</details>

## 本地开发

```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

**前提条件：** Node.js `>= 22.16.0` · `pnpm` · Windows 10/11

**常用命令：**
```bash
pnpm type-check   # 类型检查
pnpm build       # 构建
pnpm run package:prepare-deps   # download-node + download-openclaw（打安装包前）
pnpm run prepare-bundle
pnpm run package:win   # 输出: dist/OpenClaw-Setup-<version>.exe
```

**捆绑 OpenClaw：** 在 `package.json` 中通过 `openclawBundleVersion` 固定；执行 `prepare-bundle` 后查看 [`resources/bundle-manifest.json`](resources/bundle-manifest.json) 中的 `bundledOpenClawVersion`（桌面 **v0.3.0** 当前为 **2026.3.23-2**）。本地校验：`pnpm run check-openclaw-versions`（不设 `OPENCLAW_SKIP_NPM_LATEST_CHECK` 时还会与 npm `latest` 对比）。

**相关文档：** [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

[GPL-3.0](LICENSE)

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star · 贡献者 · 社区

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw Windows installer, OpenClaw desktop app,
OpenClaw setup wizard, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
