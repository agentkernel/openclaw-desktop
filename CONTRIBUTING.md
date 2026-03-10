# Contributing to OpenClaw Desktop

Thank you for considering contributing to OpenClaw Desktop. This repository is a community-maintained Windows desktop distribution for OpenClaw.

## Development Setup

### Prerequisites
- **Node.js** >= 22.12.0
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

## Pull Request Guidelines

1. Fork and create a feature branch
2. Ensure `pnpm lint` and `pnpm type-check` pass
3. Write a clear PR description
4. Reference any related issues

## Release Notes

- Release assets are published through GitHub Actions.
- The primary downloadable asset is `OpenClaw-Setup-<version>.exe`.
- For the first public versions, unsigned Windows builds may trigger SmartScreen warnings.

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.
