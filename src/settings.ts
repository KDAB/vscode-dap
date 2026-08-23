// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { expandConfigPath } from "./paths";

/**
 * A snapshot of the `kdap.*` settings for one workspace folder, with paths
 * already expanded and empty strings normalised to `undefined`.
 *
 * Reading the settings needs vscode; consuming them doesn't. Keeping the
 * result plain data means everything downstream stays unit-testable, and
 * gives one place to fix up how a setting is spelled or expanded.
 */
export interface KdapSettings {
  /** Path to the debugger binary, unresolved: it may still be a bare name to look up in PATH. */
  readonly debuggerPath: string | undefined;
  /** Where the debugger should write its DAP log, or undefined to disable logging. */
  readonly logPath: string | undefined;
  readonly logLevel: number | undefined;
  /** Extra environment variables for the debugger process itself. */
  readonly environment: Readonly<Record<string, string>> | undefined;
  readonly qtPrettyPrinters: boolean;
}

/** Treats an unset, empty or non-string value as absent. */
function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length !== 0 ? value : undefined;
}

export function readSettings(
  folder: vscode.WorkspaceFolder | undefined,
): KdapSettings {
  const config = vscode.workspace.getConfiguration("kdap", folder);
  const folderPath = folder?.uri.fsPath;

  const debuggerPath = optionalString(config.get<string>("debuggerPath"));
  const logPath = optionalString(config.get<string>("logPath"));

  return {
    debuggerPath: debuggerPath && expandConfigPath(debuggerPath, folderPath),
    logPath: logPath && expandConfigPath(logPath, folderPath),
    logLevel: config.get<number>("logLevel"),
    environment: config.get<Record<string, string>>("environment"),
    qtPrettyPrinters: config.get<boolean>("qtPrettyPrinters") ?? false,
  };
}
