// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { DebuggerBackend } from "./debuggers/backend";
import { readSettings } from "./settings";

/**
 * Gives a debugger's backend a chance to rewrite a launch configuration before
 * the session starts, for whatever it needs expressed as a DAP launch argument
 * rather than on the adapter's command line.
 */
export class DapConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  constructor(private readonly backend: DebuggerBackend) {}

  /**
   * Runs after VS Code has substituted `${workspaceFolder}` and friends, so
   * the values the backend sees are the final ones.
   */
  resolveDebugConfigurationWithSubstitutedVariables(
    folder: vscode.WorkspaceFolder | undefined,
    debugConfiguration: vscode.DebugConfiguration,
  ): vscode.DebugConfiguration {
    return this.backend.resolveConfiguration(
      debugConfiguration,
      readSettings(folder, this.backend.id),
    );
  }
}
