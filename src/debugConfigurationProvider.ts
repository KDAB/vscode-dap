// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

/** Drops the `undefined` values `NodeJS.ProcessEnv` allows but DAP's "env" doesn't. */
function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Makes a launch configuration's `env` add to the inferior's environment
 * rather than replace it.
 *
 * gdb's DAP launch handler calls `inf.clear_env()` before applying "env", so
 * whatever the configuration lists becomes the inferior's *entire*
 * environment - unlike every other DAP-based C/C++ extension (cppdbg,
 * codelldb), and losing PATH, HOME, LD_LIBRARY_PATH and friends in the
 * process. Resolving `env` to the merged result up front means gdb's
 * replacing behaviour only ever sees what the inferior should end up with.
 */
export class GDBDapConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  /**
   * Runs after VS Code has substituted `${workspaceFolder}` and friends, so
   * the values merged here are the final ones.
   */
  resolveDebugConfigurationWithSubstitutedVariables(
    folder: vscode.WorkspaceFolder | undefined,
    debugConfiguration: vscode.DebugConfiguration,
  ): vscode.DebugConfiguration {
    const env: unknown = debugConfiguration["env"];
    if (typeof env !== "object" || env === null) {
      // Absent (so gdb leaves the inherited environment alone) or malformed.
      return debugConfiguration;
    }

    // The environment the inferior would have inherited: gdb's own, which is
    // what GDBDapDescriptorFactory launches it with.
    const environment = vscode.workspace
      .getConfiguration("kdap", folder)
      .get<{ [key: string]: string }>("environment");

    debugConfiguration["env"] = {
      ...toStringEnv(process.env),
      ...environment,
      ...env,
    };
    return debugConfiguration;
  }
}
