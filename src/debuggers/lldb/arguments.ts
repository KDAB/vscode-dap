// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { SessionOptions } from "../../sessionOptions";

/** The environment variable lldb-dap writes its DAP log to. */
const LOG_ENV_VAR = "LLDBDAP_LOG";

/** What lldb-dap needs, split into how it has to be given. */
export interface LldbAdapterCommand {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  /** Options this debugger can't honour, named as the user spelled them. */
  readonly unsupported: readonly string[];
}

/**
 * Works out how to start lldb-dap. Unlike gdb, lldb-dap takes almost nothing
 * on its command line: it reads no `-iex` equivalent for the things this
 * extension configures, so logging goes through the environment and the rest
 * goes into the launch configuration (see `configuration.ts`).
 */
export function buildLldbAdapterCommand(
  options: SessionOptions,
): LldbAdapterCommand {
  const env: Record<string, string> = {};
  const unsupported: string[] = [];

  if (options.logPath) {
    env[LOG_ENV_VAR] = options.logPath;
  }

  // lldb has no sysroot: the nearest thing is "platform select --sysroot",
  // which also picks a platform, and guessing that would be wrong for the
  // remote targets sysroot exists to serve. Users who want it can say so
  // exactly, via initCommands.
  if (options.sysroot) {
    unsupported.push("sysroot");
  }

  // lldb-dap sources ~/.lldbinit unconditionally, and its "sourceInitFile"
  // launch argument does not suppress that, so there is nothing to pass.
  if (options.skipInitFiles) {
    unsupported.push("skipInitFiles");
  }

  return { args: [], env, unsupported };
}
