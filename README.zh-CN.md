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
2. 运行安装程序（文件名与 `package.json` 一致，例如 `OpenClaw-Setup-0.6.4+openclaw.2026.3.31.exe`）
3. 完成设置向导（模型提供商 → 频道 → 网关）
4. 从开始菜单或桌面快捷方式启动

**系统要求：** Windows 10/11 x64 · 约 350 MB 可用空间 · 网络连接（用于 API 调用）

## OpenClaw Desktop v0.6.4

- **Shell 版本：** `0.6.4+openclaw.2026.3.31`（主版本号 + 构建元数据中的捆绑 OpenClaw 版本）。
- **Git 发行标签：** `v0.6.4+openclaw.2026.3.31` — 与根目录 `package.json` 的 `version` 加前缀 `v` 一致，标签内可见捆绑 OpenClaw 版本号。
- **捆绑 OpenClaw（npm）：** **2026.3.31**，与当前 npm `latest`（`npm install openclaw@2026.3.31`）一致；在根目录 [`package.json`](package.json) 中用 `openclawBundleVersion` 固定。
- **桌面端近期要点：** **v0.6.4** 收尾**内嵌 Control UI / HTTP 500**：环回网关请求补 **`Origin`** 头、loopback 且未配置时合并 **`allowedOrigins: ["*"]`**、向导 **loopback** 绑定同步写入、安装包内剔除缺依赖的 **amazon-bedrock** 扩展。详见 [CHANGELOG **0.6.4**](CHANGELOG.md)。**v0.6.3** 读写合并 iframe 认证标志与写盘重试（[**0.6.3**](CHANGELOG.md)）。**v0.6.2** 约定 **Git 标签携带捆绑 OpenClaw 版本**（[**0.6.2**](CHANGELOG.md)）。飞书 `registerFull` 防护；MiniMax **仅 M2.7**；Control UI 自 GitHub 标签构建。

### 上游 OpenClaw 2026.3.31（摘要）

完整说明：[openclaw/openclaw **v2026.3.31**](https://github.com/openclaw/openclaw/releases/tag/v2026.3.31) · [npm 发布摘要](https://newreleases.io/project/npm/openclaw/release/2026.3.31)。

**本版本相对上一钉扎版的主要破坏性变更**

- **Nodes / exec：** 移除重复的 `nodes.run` shell 封装；节点 shell 执行统一走 `exec host=node`，节点能力请用 `nodes invoke` 等路径。
- **Plugin SDK：** 弃用旧版 provider 兼容子路径与部分捆绑 shim，迁移至文档化的 `openclaw/plugin-sdk/*` 入口（当前为告警，后续大版本可能移除）。
- **Skills / 插件安装：** 内置危险代码扫描为 `critical` 或安装期扫描失败时默认 **失败关闭**，可能需要 `--dangerously-force-unsafe-install` 等显式覆盖。
- **网关 / 认证：** `trusted-proxy` 拒绝混用共享令牌类配置；本机直连回退需配置令牌，不再隐式信任同机调用方。
- **网关 / Node：** Node 命令在 Node 配对获批前保持禁用；Node 触发的运行采用更收紧的信任面。

**飞书相关（上游修复）**

- **Hooks / 配置：** `hooks.mappings[].channel` 可填写运行时插件 id（例如 `feishu`），不再误拒飞书渠道（[#56226](https://github.com/openclaw/openclaw/issues/56226)）。
- **飞书 / 群组：** 引用回复与话题引导上下文与群组成员 allowlist 对齐，避免非白名单消息污染上下文。

**仍适用于本钉扎线的历史重大变更（参见 [v2026.3.28](https://github.com/openclaw/openclaw/releases/tag/v2026.3.28) 等）**

- **Qwen：** 已移除 `qwen-portal-auth`；请改用 Model Studio / `openclaw onboard --auth-choice modelstudio-api-key`。
- **配置 / Doctor：** 约两个月以上的极旧键不再自动迁移，可能直接校验失败。
- **xAI、MiniMax、CLI、Control UI、各通道：** 见 **v2026.3.28** 发布说明中的大批更新（Responses API、M2.7 目录、`openclaw config schema`、敏感配置编辑体验等）。

**提示（MiniMax 401）：** MiniMax Anthropic 兼容端点使用 **`x-api-key`**，而非 Bearer。本壳对 MiniMax 使用 `authHeader: false` 并在加载时迁移配置。其他第三方 `anthropic-messages` 主机仍可能按文档需要 `authHeader: true`。

更早的桌面发行说明见 [CHANGELOG.md](CHANGELOG.md)。

## 与上游 OpenClaw 的兼容性（捆绑 `2026.3.31`）

每个桌面发行版在根目录 [`package.json`](package.json) 中用 **`openclawBundleVersion` 钉死**要捆绑的 OpenClaw npm 版本。`pnpm run download-openclaw` 会安装该版本（除非用命令行参数或 `OPENCLAW_DESKTOP_BUNDLE_VERSION` 覆盖）。本地打包前也应先执行 `download-openclaw` 再 `prepare-bundle`。仓库中的 [`resources/bundle-manifest.json`](resources/bundle-manifest.json) 仅作参考，**实际捆绑版本以 `prepare-bundle` 写入的 `bundledOpenClawVersion` 为准**。

- **运行环境**：捆绑便携 Node.js **22.16.0**（见 `pnpm run download-node`），满足上游 `openclaw.mjs` 与 `engines` 对 Node **≥22.16** 的要求。
- **状态与配置**：与上游一致使用 `%USERPROFILE%\.openclaw`、主配置 `openclaw.json`，环境变量请使用 **`OPENCLAW_*`**（`CLAWDBOT_*` / `MOLTBOT_*`、`.moltbot` 等旧名已在上游移除）。
- **Control UI**：npm 包不再附带 `dist/control-ui/`，构建时从 **GitHub 标签 `v<版本号>`** 拉取 `ui/` + 仓库根 `src/` 等源码后执行 Vite；CI 在 Linux 构建静态资源再合并到 Windows 安装包。
- **内置插件列表**：上游将内置频道/提供商插件放在 **`dist/extensions/*`**；壳内扩展扫描已同时支持该路径与旧版顶层 `extensions/`。
- **内嵌控制台：** 本地网关下桌面会自动维护 `gateway.controlUi.allowInsecureAuth` 与 `dangerouslyDisableDeviceAuth`（非 `remote` 模式），以适配上游 Control UI 认证策略；若你手动改为 `remote` 或自行编辑该段配置，请以 [CHANGELOG 0.6.1](CHANGELOG.md) 与上游文档为准。
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
| **Git 标签 / 壳版本** | **`v0.6.4+openclaw.2026.3.31`**（即 `v` + `package.json` 的 `version`） |
| **安装包** | `OpenClaw-Setup-0.6.4+openclaw.2026.3.31.exe`（见 [Releases](https://github.com/agentkernel/openclaw-desktop/releases/latest) 实际资产名） |
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

从[最新发布页](https://github.com/agentkernel/openclaw-desktop/releases/latest)下载最新的 `OpenClaw-Setup-*.exe` 并运行即可。无需 `npm`、无需系统级 Node.js、无需输入任何终端命令。
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
<summary><strong>升级前要先删除 `%USERPROFILE%\.openclaw` 或 `openclaw.json` 吗？</strong></summary>

一般不需要。安装新版本后**启动一次**应用即可：会在读取/保存配置时自动迁移 `openclaw.json`（含内嵌控制台所需字段）。仅在配置文件损坏或你希望**完全重置**时再备份后删除或清空该目录。
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

**捆绑 OpenClaw：** 在 `package.json` 中通过 `openclawBundleVersion` 固定；执行 `prepare-bundle` 后查看 [`resources/bundle-manifest.json`](resources/bundle-manifest.json) 中的 `bundledOpenClawVersion`（桌面 **v0.6.4** 当前为 **2026.3.31**）。本地校验：`pnpm run check-openclaw-versions`（不设 `OPENCLAW_SKIP_NPM_LATEST_CHECK` 时还会与 npm `latest` 对比）。

**相关文档：** [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

[GPL-3.0](LICENSE)

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star · 贡献者 · 社区

<!-- SEO: OpenClaw Desktop, OpenClaw Windows, OpenClaw installer, OpenClaw Windows installer, OpenClaw desktop app,
OpenClaw setup wizard, OpenClaw GUI, OpenClaw app for Windows, install OpenClaw on Windows, run OpenClaw locally,
OpenClaw 桌面版, OpenClaw Windows 安装器, OpenClaw デスクトップ, OpenClaw 데스크톱, how to install openclaw, openclaw setup -->
