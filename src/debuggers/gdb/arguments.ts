// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "../../sessionOptions";

/**
 * Builds the `-iex` argument that loads the map display hint fixup shipped in
 * `printers/gdb`, which teaches gdb's DAP layer to pair up the children of a
 * map-hinted pretty printer (see kdap_map_hint.py for what goes wrong without
 * it). `scriptDir` is that directory, resolved by the caller since only it can
 * ask vscode where the extension is installed.
 */
export function buildMapHintArgs(scriptDir: string): string[] {
  return [
    "-iex",
    `python import sys; sys.path.insert(0, ${JSON.stringify(scriptDir)}); import kdap_map_hint; kdap_map_hint.install()`,
  ];
}

/**
 * Builds gdb's command line for a debug session. gdb expresses nearly
 * everything as an `-iex` command run before its init files, since its DAP
 * handler ignores launch arguments it doesn't know about.
 *
 * `pythonArgs` are the `-iex python` commands that load gdb's Python-side
 * extras - the map hint fixup, and the Qt pretty printers when they're wanted.
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
