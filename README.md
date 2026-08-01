# GDB DAP

A VS Code extension that debugs C/C++ programs using [GDB](https://sourceware.org/gdb/)'s
built-in [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) support
(`gdb -i dap`). Since GDB speaks DAP natively, this extension is a thin layer: it just finds a
suitable `gdb` binary and launches it as VS Code's debug adapter.

Requires GDB 15.2 or later, on Linux.

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

Or use the "GDB DAP: Launch" / "GDB DAP: Attach" / "GDB DAP: Load Core Dump" snippets offered
when adding a new configuration.

## Launch configuration

- `gdbPath`: Absolute path to the gdb executable to use. Overrides the `kdap.gdbPath` setting.
- `program`: Path to the executable to debug. Corresponds to gdb's `file` command.
- `args`: Command-line arguments passed to the inferior, as if by `set args`.
- `cwd`: The working directory for gdb and the launched program. Defaults to `${workspaceFolder}`.
- `env`: Environment variables for the inferior.
- `stopAtBeginningOfMainSubprogram`: Set a temporary breakpoint at `main`, as if by the `start` command.
- `stopOnEntry`: Set a temporary breakpoint at the program's first instruction, as if by the `starti` command.

## Attach configuration

- `gdbPath`: Absolute path to the gdb executable to use. Overrides the `kdap.gdbPath` setting.
- `pid`: The process ID to which gdb should attach.
- `program`: Path to the executable being debugged.
- `target`: The target to which gdb should connect, passed to `target remote`.
- `coreFile`: Path to a core dump file to load instead of attaching to a live process.

## Settings

- `kdap.gdbPath`: Path to the gdb binary. Defaults to searching `PATH`.
- `kdap.logPath`: Enable DAP logging to this file.
- `kdap.logLevel`: DAP logging verbosity (default `1`).
- `kdap.environment`: Extra environment variables set on the gdb process itself.
