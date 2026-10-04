// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "../../sessionOptions";

/**
 * The Python modules shipped in `printers/gdb` that every gdb session loads,
 * each of which fixes how gdb's DAP layer presents something:
 *
 * - `kdap_map_hint` pairs up the children of a map-hinted pretty printer.
 * - `kdap_qml_frames` shows the QML functions on a call stack instead of the
 *   interpreter frames running them.
 *
 * Both do nothing where there is nothing for them to fix.
 */
const BUNDLED_GDB_MODULES = ["kdap_map_hint", "kdap_qml_frames"];

/**
 * Builds the `-iex` arguments that load the modules shipped in `printers/gdb`
 * (see BUNDLED_GDB_MODULES). `scriptDir` is that directory, resolved by the
 * caller since only it can ask vscode where the extension is installed. One
 * `-iex` per module, so that one failing to load doesn't take the other with it.
 */
export function buildBundledScriptArgs(scriptDir: string): string[] {
  return BUNDLED_GDB_MODULES.flatMap((module) => [
    "-iex",
    `python import sys; sys.path.insert(0, ${JSON.stringify(scriptDir)}); import ${module}; ${module}.install()`,
  ]);
}

/**
 * Builds gdb's command line for a debug session. gdb expresses nearly
 * everything as an `-iex` command run before its init files, since its DAP
 * handler ignores launch arguments it doesn't know about.
 *
 * `pythonArgs` are the `-iex python` commands that load gdb's Python-side
 * extras - the bundled modules, and the Qt pretty printers when they're wanted.
 * They're passed in rather than derived here because obtaining them needs to
 * know where this extension is installed, and may have to prompt the user to
 * download the printers first.
 */
export function buildGdbArgs(
  options: SessionOptions,
  pythonArgs: readonly string[] = [],
): string[] {
  const args = ["-q", "-i", "dap"];

  if (options.skipInitFiles) {
    args.push("-nx");
  }

  if (options.sysroot) {
    args.push("-iex", `set sysroot ${options.sysroot}`);
  }

  for (const [from, to] of Object.entries(options.sourceFileMap)) {
    args.push("-iex", `set substitute-path ${from} ${to}`);
  }

  if (options.logPath) {
    args.push("-iex", `set debug dap-log-file ${options.logPath}`);
    if (options.logLevel !== undefined) {
      args.push("-iex", `set debug dap-log-level ${options.logLevel}`);
    }
  }

  args.push(...pythonArgs);

  return args;
}
