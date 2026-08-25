# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KDAB DAP is a VS Code extension that debugs C/C++ programs using GDB's and LLDB's own Debug
Adapter Protocol support. Unlike most debugger extensions, it doesn't implement any part of the
DAP protocol itself — both debuggers already speak DAP natively (`gdb -i dap`, and LLDB's
`lldb-dap` binary) — so the extension's only job is to find a suitable debugger, work out what to
pass it, and hand it to VS Code as the debug adapter process.

Two debug types, one per debugger: `kdap` (gdb, 16.1+) and `kdap-lldb` (lldb-dap, no version
floor). Linux only, by design.

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
./test.sh                    # Everything; requires gcc, and gdb 16.1+ and/or lldb-dap, on PATH
./test.sh --unit             # Unit tests only, no VS Code instance needed
./test.sh --gdb              # Integration tests against gdb only
./test.sh --lldb             # Integration tests against lldb-dap only
./build_package.sh           # Package the extension as a .vsix file
./test-printers.sh           # The standalone suites under printers/; needs g++, gdb, lldb and Qt
                             # (Qt with debug info: QUrl's printer reads QUrlPrivate, which only
                             #  libQt6Core's own debug info describes - see printers/lldb/qt/README.md)
```

`./test.sh` wraps `npm test`, which is `npm run test:unit` (plain mocha) followed by
`npm run test:integration` (`vscode-test`, which boots a real VS Code per suite).

The integration debug suite runs once per debugger in the registry, inside one VS Code instance,
skipping any debugger that isn't installed. `--gdb` / `--lldb` set `KDAP_TEST_DEBUGGERS`.

## Architecture

Everything outside `src/debuggers/` is debugger-agnostic. **No file outside that directory
should name gdb or lldb** — adding a debugger means adding a backend and a `contributes.debuggers`
entry, nothing else.

- `src/extension.ts` — activation entry point; registers a `DapDescriptorFactory` and a
  `DapConfigurationProvider` per entry in the backend registry.
- `src/debuggers/backend.ts` — the `DebuggerBackend` interface. It deliberately covers both the
  adapter's argv and the launch configuration: gdb expresses nearly everything as an `-iex`
  command because its DAP handler ignores launch arguments it doesn't know, while lldb-dap
  expresses most of the same things as DAP launch arguments.
- `src/debuggers/registry.ts` — the list of backends, and the debug types derived from it.
- `src/sessionOptions.ts` — parses a launch configuration plus the settings into
  `SessionOptions`, the debugger-independent intents (sysroot, sourceFileMap, logging, …). Only
  intents that make sense for more than one debugger belong here; single-debugger properties stay
  in the launch configuration and are read by that backend.
- `src/settings.ts` — reads `kdap.*` into a plain-data snapshot. Settings whose meaning depends
  on the debugger live under `kdap.<backend id>.`; `kdap.logPath` and `kdap.environment` are
  shared.
- `src/debugAdapterFactory.ts` — resolves the binary (launch config's `debuggerPath` >
  `kdap.<debugger>.path` setting > the backend's own `PATH` lookup), lets the backend vet it and
  render the command line, and reports whatever the backend says it can't support.
- `src/debuggers/gdb/` — `arguments.ts` (argv, `-iex` commands), `version.ts` (the 16.1 floor),
  `prettyPrinters.ts` (the Qt printer download), `backend.ts` (the wiring, plus the
  `inf.clear_env()` workaround that makes a launch config's `env` merge rather than replace).
- `src/debuggers/lldb/` — `arguments.ts` (`LLDBDAP_LOG`, and the options lldb can't honour),
  `configuration.ts` (`sourceMap`), `backend.ts` (the wiring).
- `printers/` — Python a backend loads into its debugger, bundled in the `.vsix`:
  `printers/lldb/qt/` (Qt pretty printers, which lldb doesn't ship) and `printers/gdb/`
  (`kdap_map_hint.py`, which makes gdb's DAP layer pair up the children of a `map`-hinted pretty
  printer instead of showing `[0].key` / `[0].value` rows). Each has a standalone test suite
  under `tests/`, all of them run by `./test-printers.sh`.

`arguments.ts`, `configuration.ts`, `version.ts`, `sessionOptions.ts` and `paths.ts` take no
vscode dependency, which is where the logic lives and where the unit tests reach it; the
`backend.ts` files are the thin vscode-facing wiring.

### Tests

- `src/test/integration/smoke.test.ts` — extension activation and configuration sanity checks.
- `src/test/integration/debug.test.ts` — a loop over `enabledTestDebuggers()`, which reads the
  extension's own backend registry, so registering a backend runs the suite against it.
- `src/test/integration/debugSuite.ts` — the suite body, defined once per debugger. Everything
  asserted here is a promise the extension makes regardless of which debugger is behind it, so
  the assertions are identical per debugger rather than switched on the descriptor: making them
  hold on a new debugger is the extension's job, not the test's. This is the test that actually
  exercises the DAP-to-DAP communication path.
- `src/test/unit/` — plain mocha, run without a VS Code instance, so nothing here (nor anything
  it imports) may `import "vscode"`. Registered by the `test:unit` glob rather than by name,
  unlike the integration suites, which `.vscode-test.js` lists individually.

## Development Workflow

- **ESLint** uses `js.configs.recommended` plus typescript-eslint's `recommendedTypeChecked`
  (type-aware, so rules like `no-floating-promises` apply), and `npm run lint` allows zero
  warnings. Run it before committing — pre-commit does not.
- **Prettier** (`npm run format:check` / `format:fix`) covers `src/**/*.ts`. Run it before
  committing too; pre-commit does not.
- **pre-commit** (`.pre-commit-config.yaml`) only enforces conventional commit messages and
  runs codespell.
- **GitHub Actions** enforces ESLint and Prettier on every PR and push (`.github/workflows/lints.yml`)
- CI is Linux-only and split by debugger: `.github/workflows/build-gdb.yml` installs only gdb
  and runs `./test.sh --gdb`, `.github/workflows/build-lldb.yml` installs only lldb and runs
  `./test.sh --lldb`.

## Conventions

- **Conventional commits**: prefix with `fix:`, `feat:`, or `chore:`
- **Releases**: managed automatically via `release-please` (`.github/workflows/release-please.yml`);
  merge the Release PR to trigger changelog + version bump + tag
- **Publishing**: `.github/workflows/package.yml` builds the `.vsix`; upload manually to the
  VS Marketplace at marketplace.visualstudio.com/manage/publishers/KDAB
