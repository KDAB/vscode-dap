// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { DebuggerBackend, isBackendError } from "./debuggers/backend";
import {
  expandTilde,
  findExecutableInPath,
  isDirectory,
  isExecutable,
  resolveExecutablePath,
} from "./paths";
import { parseSessionOptions } from "./sessionOptions";
import { KdapSettings, readSettings } from "./settings";

/**
 * Shows an error with a shortcut to the setting that would fix it, since every
 * failure in here is a matter of pointing the extension at the right binary.
 */
async function showErrorWithSetting(message: string, settingKey: string) {
  const openSettingsAction = "Open Settings";
  const choice = await vscode.window.showErrorMessage(
    message,
    openSettingsAction,
  );

  if (choice === openSettingsAction) {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      settingKey,
    );
  }
}

/**
 * Launches a debugger as VS Code's debug adapter, resolving which binary to
 * use from the launch configuration, the extension settings, or PATH, in that
 * order.
 *
 * Which debugger, and what to pass it, is entirely up to the `DebuggerBackend`
 * this is constructed with - one instance per supported debugger.
 */
export class DapDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable
{
  constructor(
    private readonly backend: DebuggerBackend,
    private readonly context: vscode.ExtensionContext,
  ) {}

  dispose() {}

  async createDebugAdapterDescriptor(
    session: vscode.DebugSession,
  ): Promise<vscode.DebugAdapterDescriptor | undefined> {
    const settings = readSettings(session.workspaceFolder);

    const binaryPath = await this.resolveBinaryPath(session, settings);
    if (!binaryPath || !(await isExecutable(binaryPath))) {
      await this.showBinaryNotFoundMessage(binaryPath);
      return undefined;
    }

    const unusable = await this.backend.checkBinary(binaryPath);
    if (unusable) {
      await showErrorWithSetting(unusable, this.backend.pathSettingKey);
      return undefined;
    }

    const options = parseSessionOptions(session.configuration, settings);

    if (options.sysroot && !(await isDirectory(options.sysroot))) {
      await vscode.window.showErrorMessage(
        `sysroot path '${options.sysroot}' is not an existing folder.`,
      );
      return undefined;
    }

    const command = await this.backend.adapterCommand(options, {
      extensionContext: this.context,
    });
    if (isBackendError(command)) {
      await vscode.window.showErrorMessage(command.message);
      return undefined;
    }

    // kdap.environment is the user's escape hatch; anything the backend
    // derived from a more specific setting takes precedence over it.
    const env = { ...settings.environment, ...command.env };
    const executableOptions =
      Object.keys(env).length !== 0 ? { env } : undefined;

    return new vscode.DebugAdapterExecutable(
      binaryPath,
      [...command.args],
      executableOptions,
    );
  }

  private async resolveBinaryPath(
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

    // Fall back to searching PATH, preferring the earlier candidates.
    for (const name of this.backend.binaryNames) {
      const found = await findExecutableInPath(name);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private async showBinaryNotFoundMessage(binaryPath?: string) {
    const { displayName, installHint, pathSettingKey } = this.backend;
    const message = binaryPath
      ? `${displayName} path '${binaryPath}' is not a valid executable.`
      : `Unable to find ${displayName}. ${installHint}, or set ${pathSettingKey}.`;
    await showErrorWithSetting(message, pathSettingKey);
  }
}
