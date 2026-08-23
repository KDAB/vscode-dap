# KDAB DAP

A VS Code extension that debugs C/C++ programs using [GDB](https://sourceware.org/gdb/)'s
built-in [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) support
(`gdb -i dap`). Since GDB speaks DAP natively, this extension is a thin layer: it just finds a
suitable `gdb` binary and launches it as VS Code's debug adapter.

Requires GDB 16.1 or later, on Linux. Older GDBs run the inferior as part of the DAP `launch`
request instead of deferring it to `configurationDone`, so breakpoints set before the program
starts are never hit, and they ignore `stopOnEntry`.

## Usage

Create a launch configuration in `.vscode/launch.json`:

```jsonc
{
  "type": "kdap",
  "request": "launch",
  "name": "Launch",
  "program": "${workspaceFolder}/<your program>",
  "args": [],
  "cwd": "${workspaceFolder}",
  "stopOnEntry": true
}
```

Or use the "GDB: Launch" / "GDB: Attach" / "GDB: Load Core Dump" snippets offered
when adding a new configuration.

## Launch configuration

- `debuggerPath`: Path to the gdb executable to use, with a leading `~` expanded. Overrides the
  `kdap.gdb.path` setting.
- `sysroot`: Path to the system root gdb should use when looking for shared libraries and debug
  info, as if by `set sysroot`. If empty or omitted, gdb's default sysroot handling applies.
- `skipInitFiles`: Skip reading gdb's init files, as if by passing `-nx`. Defaults to `false`.
- `sourceFileMap`: Maps source paths recorded in the debug info to their location on disk, as if
  by `set substitute-path`.
- `program`: Path to the executable to debug. Corresponds to gdb's `file` command.
- `args`: Command-line arguments passed to the inferior, as if by `set args`.
- `cwd`: The working directory for gdb and the launched program. If omitted, gdb inherits VS Code's
  working directory rather than the workspace folder, so set this explicitly.
- `env`: Environment variables for the inferior. Setting this **replaces** the inferior's entire
  environment rather than adding to it, so `PATH`, `HOME`, etc. must be listed too. If omitted, the
  inferior inherits gdb's environment.
- `stopAtBeginningOfMainSubprogram`: Set a temporary breakpoint at `main`, as if by the `start`
  command. Defaults to `false`.
- `stopOnEntry`: Set a temporary breakpoint at the program's first instruction, as if by the
  `starti` command. Defaults to `false`.

## Attach configuration

- `debuggerPath`: Path to the gdb executable to use, with a leading `~` expanded. Overrides the
  `kdap.gdb.path` setting.
- `sysroot`: Path to the system root gdb should use when looking for shared libraries and debug
  info, as if by `set sysroot`. If empty or omitted, gdb's default sysroot handling applies.
- `skipInitFiles`: Skip reading gdb's init files, as if by passing `-nx`. Defaults to `false`.
- `sourceFileMap`: Maps source paths recorded in the debug info to their location on disk, as if
  by `set substitute-path`.
- `pid`: The process ID to which gdb should attach.
- `program`: Path to the executable being debugged.
- `target`: The target to which gdb should connect, passed to `target remote`.
- `coreFile`: Path to a core dump file to load instead of attaching to a live process.

## Settings

- `kdap.gdb.path`: Path to the gdb binary. Defaults to searching `PATH`.
- `kdap.logPath`: Enable DAP logging to this file.
- `kdap.gdb.logLevel`: gdb's DAP logging verbosity (default `1`).
- `kdap.environment`: Extra environment variables set on the debugger process itself.
- `kdap.gdb.qtPrettyPrinters`: Automatically load Qt pretty-printers for gdb (default `true`). If
  they haven't been downloaded yet, starting a debug session offers to download them; declining
  starts the session without them.

## Commands

- **KDAB DAP: Download Qt Pretty Printers** — downloads the
  [KDevelop Qt gdb pretty-printer scripts](https://github.com/iamsergio/kdevelop/tree/vscode-gdb-dap/plugins/gdb/printers)
  into the extension's global storage. Run this once via the Command Palette to enable Qt
  pretty-printing (see `kdap.qtPrettyPrinters` above).
- **KDAB DAP: Debug with Args** — starts one of your `kdap` launch configurations, prompting for
  the arguments to pass to the inferior instead of using the configuration's `args`. The input
  is split like a shell splits a command line, so quote arguments containing spaces.
- **KDAB DAP: Run with Args** — the same, but without debugging: breakpoints and entry stops are
  ignored.
