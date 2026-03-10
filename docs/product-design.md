# Product Design Notes

## Product Goal

Make `OpenClaw` easier to install and run on Windows by replacing a terminal-first setup flow with a native desktop experience.

## Core User Problems

- Installing Node.js and CLI dependencies is a barrier for many Windows users.
- Manual environment and provider configuration is error-prone.
- Users need a clearer path to updates, diagnostics, and rollback.

## Product Principles

- Ship a working installer first.
- Keep the workflow explicit and easy to recover when something fails.
- Reuse the upstream OpenClaw runtime rather than reimplementing it.
- Be transparent that this is a community-maintained desktop distribution.

## Primary UX Areas

- Setup wizard: make the first run understandable and fast.
- Dashboard: expose current status and quick actions.
- Update center: surface releases, health checks, and repair guidance.
- Diagnostics: make support and issue reporting easier.

## Release Philosophy

- Put the Windows installer in a prominent place on every release.
- Keep release artifacts predictable for both people and the in-app updater.
- Use GitHub Actions to keep build and release steps repeatable.
