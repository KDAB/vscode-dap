// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "../../sessionOptions";

/**
 * Builds gdb's command line for a debug session. gdb expresses nearly
 * everything as an `-iex` command run before its init files, since its DAP
 * handler ignores launch arguments it doesn't know about.
 *
 * `prettyPrinterArgs` is passed in rather than derived here because obtaining
 * it may have to prompt the user to download the printers first.
 */
export function buildGdbArgs(
  options: SessionOptions,
  prettyPrinterArgs: readonly string[] = [],
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

  args.push(...prettyPrinterArgs);

  return args;
}
