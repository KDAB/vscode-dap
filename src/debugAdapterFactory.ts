// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { buildGdbArgs } from "./gdbArguments";
import { getQtPrettyPrintersArgs } from "./gdbPrettyPrinters";
import {
  getGdbVersion,
  isGdbVersionSufficient,
  MIN_GDB_VERSION,
} from "./gdbVersion";
import {
  expandTilde,
  findExecutableInPath,
  isDirectory,
  isExecutable,
  resolveExecutablePath,
} from "./paths";
import { parseSessionOptions } from "./sessionOptions";
import { KdapSettings, readSettings } from "./settings";

async function getDebuggerPath(
  session: vscode.DebugSession,
  settings: KdapSettings,
): Promise<string | undefined> {
  // Explicit path in the launch configuration takes priority.
  const launchConfigPath: unknown = session.configuration["debuggerPath"];
  if (typeof launchConfigPath === "string" && launchConfigPath.length !== 0) {
    // VS Code substitutes ${workspaceFolder} in launch.json, but not `~`.
    return resolveExecutablePath(expandTilde(launchConfigPath));
  }

  // Then the extension's own setting.
  if (settings.debuggerPath) {
    return resolveExecutablePath(settings.debuggerPath);
  }

  // Fall back to searching PATH.
  return findExecutableInPath("gdb");
}

/**
 * Launches gdb in DAP mode (`gdb -i dap`) for a debug session, resolving
 * which gdb binary to use from the launch configuration, extension settings,
 * or PATH, in that order.
 */
export class GDBDapDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable
{
  constructor(private readonly context: vscode.ExtensionContext) {}

  dispose() {}

  async createDebugAdapterDescriptor(
    session: vscode.DebugSession,
  ): Promise<vscode.DebugAdapterDescriptor | undefined> {
    const settings = readSettings(session.workspaceFolder);

    const debuggerPath = await getDebuggerPath(session, settings);
    if (!debuggerPath || !(await isExecutable(debuggerPath))) {
      await GDBDapDescriptorFactory.showGdbNotFoundMessage(debuggerPath);
      return undefined;
    }

    const version = await getGdbVersion(debuggerPath);
    if (!version || !isGdbVersionSufficient(version)) {
      await GDBDapDescriptorFactory.showGdbVersionTooOldMessage(
        debuggerPath,
        version,
      );
      return undefined;
    }

    const options = parseSessionOptions(session.configuration, settings);

    if (options.sysroot && !(await isDirectory(options.sysroot))) {
      await GDBDapDescriptorFactory.showSysrootNotFoundMessage(options.sysroot);
      return undefined;
    }

    const prettyPrinterArgs = options.qtPrettyPrinters
      ? await getQtPrettyPrintersArgs(this.context)
      : [];

    const args = buildGdbArgs(options, prettyPrinterArgs);

    // VS Code merges this into the extension host's own environment, so gdb
    // ends up with `process.env` plus these. GDBDapConfigurationProvider
    // relies on that when it works out what the inferior inherits.
    const executableOptions = settings.environment
      ? { env: { ...settings.environment } }
      : undefined;

    return new vscode.DebugAdapterExecutable(
      debuggerPath,
      args,
      executableOptions,
    );
  }

  /** Shows a message box when the gdb executable can't be found. */
  static async showGdbNotFoundMessage(debuggerPath?: string) {
    const message = debuggerPath
      ? `gdb path '${debuggerPath}' is not a valid executable.`
      : `Unable to find gdb. Install GDB ${MIN_GDB_VERSION[0]}.${MIN_GDB_VERSION[1]} or later, or set kdap.debuggerPath.`;
    const openSettingsAction = "Open Settings";
    const choice = await vscode.window.showErrorMessage(
      message,
      openSettingsAction,
    );

    if (choice === openSettingsAction) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "kdap.debuggerPath",
      );
    }
  }

  /** Shows a message box when the launch configuration's `sysroot` doesn't point at an existing folder. */
  static async showSysrootNotFoundMessage(sysrootPath: string) {
    await vscode.window.showErrorMessage(
      `sysroot path '${sysrootPath}' is not an existing folder.`,
    );
  }

  /** Shows a message box when the gdb executable's version is too old, or couldn't be determined. */
  static async showGdbVersionTooOldMessage(
    debuggerPath: string,
    version: [number, number] | undefined,
  ) {
    const [minMajor, minMinor] = MIN_GDB_VERSION;
    const message = version
      ? `gdb at '${debuggerPath}' is version ${version[0]}.${version[1]}, but this extension requires ${minMajor}.${minMinor} or later.`
      : `Unable to determine the version of gdb at '${debuggerPath}'. This extension requires gdb ${minMajor}.${minMinor} or later.`;
    const openSettingsAction = "Open Settings";
    const choice = await vscode.window.showErrorMessage(
      message,
      openSettingsAction,
    );

    if (choice === openSettingsAction) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "kdap.debuggerPath",
      );
    }
  }
}
