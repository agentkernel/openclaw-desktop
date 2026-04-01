# Contributing to OpenClaw Desktop

Thank you for considering contributing to OpenClaw Desktop. This repository is a community-maintained Windows desktop distribution for OpenClaw.

## Development Setup

### Prerequisites
- **Node.js** >= 22.16.0 (matches `package.json` `engines`)
- **pnpm** (latest)
- **Windows 10/11** (for testing)

### Quick Start
```bash
git clone https://github.com/agentkernel/openclaw-desktop.git
cd openclaw-desktop
pnpm install
pnpm dev
```

## Project Structure

```
src/
├── main/        # Electron main process (Gateway, IPC, Config, Update)
├── renderer/    # React UI (Wizard, Shell views, i18n)
├── preload/     # Context bridge (IPC)
└── shared/      # Types, constants, IPC channels
```

## Code Style

- **TypeScript** — strict mode, no `any` where avoidable
- **React** — functional components, hooks
- **Tailwind CSS** — utility-first styling
- **No unnecessary comments** — code should be self-explanatory

## Testing

```bash
pnpm lint        # ESLint
pnpm type-check  # TypeScript strict check
pnpm build       # Production build
pnpm run package:win  # Windows installer
```

## Packaging the Windows installer (local)

`package:win` assumes **`build/node/`** and **`build/openclaw/`** already exist. Run these **before** the one-liner (or use the shortcut):

```bash
pnpm run package:prepare-deps   # download-node + download-openclaw (npm openclaw@latest)
pnpm lint && pnpm type-check
pnpm run package:win
```

**Control UI (`dist/control-ui/`):** On some Windows machines the upstream Vite/Rolldown UI build fails. Options:

- Let `download-openclaw` build it (default), or
- Build on Linux / WSL and copy: `build/openclaw/dist/control-ui/` from artifact or `pnpm exec tsx scripts/ci-build-openclaw-control-ui.ts`, then run `pnpm run download-openclaw` with `OPENCLAW_SKIP_CONTROL_UI_BUILD=1` if you already populated that folder.

**After packaging:** `prepare-bundle` (inside `package:win`) refreshes `resources/bundle-manifest.json` with the resolved OpenClaw version.

## Pull Request Guidelines

1. Fork and create a feature branch
2. Ensure `pnpm lint` and `pnpm type-check` pass
3. Write a clear PR description
4. Reference any related issues

## Release Notes

- Release assets are published through GitHub Actions.
- The primary downloadable asset is `OpenClaw-Setup-<version>.exe`.
- For the first public versions, unsigned Windows builds may trigger SmartScreen warnings.
- **Bundled OpenClaw** version is stored in `resources/bundle-manifest.json` as `bundledOpenClawVersion` (updated by `pnpm run prepare-bundle` from `build/openclaw`). The pin lives in root `package.json` as `openclawBundleVersion`. Desktop **v0.6.2** ships OpenClaw **2026.3.31** alongside shell semver `0.6.2+openclaw.2026.3.31`. **Release Git tags** use `v` + that semver, e.g. **`v0.6.2+openclaw.2026.3.31`** (bundled OpenClaw version is visible in the tag).

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.
