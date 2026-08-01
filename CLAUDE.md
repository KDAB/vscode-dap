# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GDB DAP is a VS Code extension that debugs C/C++ programs using GDB's built-in Debug Adapter
Protocol support (`gdb -i dap`). Unlike most debugger extensions, it doesn't implement any part
of the DAP protocol itself — GDB already speaks DAP natively, so the extension's only job is to
find a suitable `gdb` binary and hand it to VS Code as the debug adapter process.

Linux and GDB only, by design.

## Commands

### Development

```bash
npm run watch                # Watch TypeScript files and recompile on changes
npm run lint                 # ESLint (zero warnings)
npm run format:check         # Prettier formatting check
npm run format:fix           # Auto-format with Prettier
npm run compile              # Compile TypeScript to JavaScript
```

### Testing & Building

```bash
npm test                     # Requires GDB 15.2+ and gcc on PATH
./build_package.sh           # Package the extension as a .vsix file
```

## Architecture

- `src/extension.ts` — activation entry point; registers `GDBDapDescriptorFactory` as the
  `vscode.DebugAdapterDescriptorFactory` for the `kdap` debugger type.
- `src/debugAdapterFactory.ts` — resolves which `gdb` binary to launch (launch config's
  `gdbPath` > `kdap.gdbPath` setting > `PATH` lookup) and builds the `gdb -i dap` command line,
  including optional DAP logging flags.
- `src/gdbPrettyPrinters.ts` — implements the "GDB DAP: Download Qt Pretty Printers" command,
  which fetches the KDevelop Qt gdb pretty-printer scripts into the extension's global storage
  for use when `kdap.qtPrettyPrinters` is enabled.

### Tests

- `src/test/integration/smoke.test.ts` — extension activation and configuration sanity checks.
- `src/test/integration/debug.test.ts` — compiles `test/fixtures/hello.c` with gcc, starts a
  real `kdap` debug session, sets a breakpoint, and verifies GDB stops there and can evaluate an
  expression. This is the test that actually exercises the DAP-to-DAP communication path.

## Development Workflow

- **ESLint** (strict, zero warnings allowed) and **Prettier** run automatically via pre-commit
  hooks (configured in `.pre-commit-config.yaml`)
- **GitHub Actions** enforces linting on every PR and push (`.github/workflows/lints.yml`)
- CI (`.github/workflows/build.yml`) is Linux-only, since this extension only supports GDB on Linux.

## Conventions

- **Conventional commits**: prefix with `fix:`, `feat:`, or `chore:`
- **Releases**: managed automatically via `release-please` (`.github/workflows/release-please.yml`);
  merge the Release PR to trigger changelog + version bump + tag
- **Publishing**: `.github/workflows/package.yml` builds the `.vsix`; upload manually to the
  VS Marketplace at marketplace.visualstudio.com/manage/publishers/KDAB
