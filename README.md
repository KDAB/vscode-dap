# KDAB DAP

A VS Code extension that debugs C/C++ programs using
[GDB](https://sourceware.org/gdb/)'s and [LLDB](https://lldb.llvm.org/)'s own
[Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) support. Both
debuggers speak DAP natively — GDB as `gdb -i dap`, LLDB through its `lldb-dap` binary — so this
extension is a thin layer: it finds a suitable debugger, works out what to pass it, and hands it
to VS Code as the debug adapter.

Linux and macOS. Windows is out of scope, by design.

There are two debug types, one per debugger:

| Debug type   | Debugger   | Platforms     | Requires                              |
| ------------ | ---------- | ------------- | ------------------------------------- |
| `kdap`       | `gdb`      | Linux         | GDB 16.1 or later                     |
| `kdap-lldb`  | `lldb-dap` | Linux, macOS  | LLDB, including its `lldb-dap` binary |

GDB 16.1 is the floor because older GDBs run the inferior as part of the DAP `launch` request
instead of deferring it to `configurationDone`, so breakpoints set before the program starts are
never hit, and they ignore `stopOnEntry`. LLDB has no comparable floor, so there is no version
check for it.

gdb is Linux-only here for a reason that isn't the extension's to fix: macOS requires a debugger
to be code-signed for debugging, and gdb isn't. Use `kdap-lldb` there. Nothing stops a `kdap`
configuration on macOS if you have a gdb that works — it just won't be found by default.

`lldb-dap` is looked up as `lldb-dap`, falling back to the highest `lldb-dap-<version>` on
`PATH`, since distributions often ship only the suffixed name. On macOS, where Xcode and the
Command Line Tools keep `lldb-dap` inside the developer directory instead of on `PATH`, it then
asks `xcrun` for it, so a stock install needs no configuration.

### macOS and code signing

The `lldb-dap` that comes with Xcode is signed for debugging and works as-is. One from Homebrew
or an LLVM release is only ad-hoc signed, and launching under it fails with
`attach failed (Not allowed to attach to process)` until its `debugserver` is signed with
`com.apple.security.cs.debugger`, or `LLDB_DEBUGSERVER_PATH` points at Xcode's. Since `PATH` is
searched before `xcrun`, an unsigned one on `PATH` is what gets picked — set `kdap.lldb.path` to
Xcode's, or unset it from `PATH`, if you hit this. Attaching by `pid` to a process you don't own
needs elevation on macOS, as it does elsewhere.

## Usage

Create a launch configuration in `.vscode/launch.json`:

```jsonc
{
  "type": "kdap", // or "kdap-lldb"
  "request": "launch",
  "name": "Launch",
  "program": "${workspaceFolder}/<your program>",
  "args": [],
  "cwd": "${workspaceFolder}",
  "stopOnEntry": true
}
```

Or use the "GDB: Launch" / "LLDB: Launch" snippets, and their Attach and Load Core Dump
counterparts, offered when adding a new configuration.

## Shared configuration

These mean the same thing under both debuggers, in both `launch` and `attach` configurations.

- `debuggerPath`: Path to the debugger executable to use, with a leading `~` expanded. Overrides
  the `kdap.gdb.path` / `kdap.lldb.path` setting.
- `sourceFileMap`: Maps source paths recorded in the debug info to their location on disk. Each
  key is the path as recorded, each value where it is found locally. Applied with
  `set substitute-path` under gdb and `target.source-map` under lldb.
- `program`: Path to the executable to debug.
- `sysroot`: Where to look for shared libraries and debug info, as if by `set sysroot`.
  **gdb only** — lldb's nearest equivalent, `platform select --sysroot`, also picks a platform,
  which would be the wrong guess for the remote targets sysroot exists to serve. Use
  `initCommands` under lldb to say exactly what you mean.
- `skipInitFiles`: Skip reading the debugger's own init files, as if by passing `-nx`.
  **gdb only** — `lldb-dap` sources `~/.lldbinit` unconditionally and offers no way to stop it.
- `qtPrettyPrinters`: Automatically load Qt pretty-printers (default `false`). Under gdb, this
  downloads the KDevelop Qt gdb pretty-printer scripts on first use, offering to do so if they
  aren't there yet. Under lldb-dap, this imports the Qt pretty-printers bundled with the
  extension - nothing to download.

Setting a gdb-only option on an `kdap-lldb` session isn't fatal: the session starts and a
warning says what was ignored.

### Launch

- `args`: Command-line arguments passed to the inferior.
- `cwd`: The working directory for the debugger and the launched program. If omitted, the
  debugger inherits VS Code's working directory rather than the workspace folder, so set this
  explicitly.
- `env`: Environment variables for the inferior. These are **added** to the environment the
  inferior would otherwise inherit; `PATH`, `HOME` and friends survive. (gdb's DAP handler
  replaces the whole environment instead; the extension works around that so both debuggers
  behave the same way.)
- `stopOnEntry`: Stop at the program's first instruction. Defaults to `false`.
- `stopAtBeginningOfMainSubprogram`: Stop at `main`, as if by gdb's `start` command. **gdb only.**

### Attach

- `pid`: The process ID to attach to.
- `coreFile`: Path to a core dump file to load instead of attaching to a live process.
- `target`: The target to connect to, passed to `target remote`. **gdb only** — under lldb, use
  `initCommands` with `gdb-remote` or `platform connect`.

## lldb-dap configuration

`kdap-lldb` configurations also accept `lldb-dap`'s own properties, which it reads directly:
`initCommands`, `preRunCommands`, `postRunCommands`, `stopCommands`, `exitCommands`,
`terminateCommands`, `launchCommands`, `attachCommands`, `runInTerminal`, `waitFor`,
`platformName`, `targetTriple`, `debuggerRoot`, `disableASLR`, `disableSTDIO`,
`shellExpandArguments`, `detachOnError`, `enableAutoVariableSummaries`,
`enableSyntheticChildDebugging`, `displayExtendedBacktrace`, `customFrameFormat`,
`customThreadFormat` and `timeout`. See
[lldb-dap's documentation](https://lldb.llvm.org/resources/lldbdap.html) for what each does.

## Settings

- `kdap.gdb.path`: Path to the gdb binary. Defaults to searching `PATH`.
- `kdap.lldb.path`: Path to the lldb-dap binary. Defaults to searching `PATH`, then `xcrun` on
  macOS.
- `kdap.logPath`: Enable DAP logging to this file, for whichever debugger is in use.
- `kdap.gdb.logLevel`: gdb's DAP logging verbosity (default `1`). gdb only; lldb-dap has no
  equivalent.
- `kdap.environment`: Extra environment variables set on the debugger process itself.

## Commands

- **KDAB DAP: Download Qt Pretty Printers** — downloads the
  [KDevelop Qt gdb pretty-printer scripts](https://github.com/iamsergio/kdevelop/tree/vscode-gdb-dap/plugins/gdb/printers)
  into the extension's global storage. Run this once via the Command Palette to enable Qt
  pretty-printing (see `qtPrettyPrinters` above). Linux only, being for gdb; lldb's Qt
  pretty-printers ship with the extension and need no download.
- **KDAB DAP: Debug with Args** — starts one of your launch configurations, prompting for the
  arguments to pass to the inferior instead of using the configuration's `args`. The input is
  split like a shell splits a command line, so quote arguments containing spaces.
- **KDAB DAP: Run with Args** — the same, but without debugging: breakpoints and entry stops are
  ignored.
- **KDAB DAP: Load Core File** — starts one of your `attach` configurations against a core dump,
  prompting for the core file and program if the configuration doesn't name them.

The last three work with both debug types, on both platforms.
