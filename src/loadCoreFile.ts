// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import {
  findKdapLaunchConfigurations,
  pickLaunchConfiguration,
} from "./launchConfigPicker";
import { expandConfigPath, isFile } from "./paths";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Resolves `propertyName` on `config`: uses it if present, otherwise prompts
 * with a file picker. Either way, errors out (returning undefined) if nothing
 * is picked or if the resulting path doesn't exist.
 */
async function resolvePathProperty(
  propertyName: string,
  displayName: string,
  dialogTitle: string,
  config: vscode.DebugConfiguration,
  folder: vscode.WorkspaceFolder | undefined,
): Promise<string | undefined> {
  const configValue: unknown = config[propertyName];

  let resolvedPath: string;
  if (typeof configValue === "string" && configValue.length !== 0) {
    // These configurations are read directly from settings rather than
    // obtained via the debug-start flow, so VS Code hasn't substituted
    // ${workspaceFolder} in them yet.
    resolvedPath = expandConfigPath(configValue, folder?.uri.fsPath);
  } else {
    const picked = await vscode.window.showOpenDialog({
      title: dialogTitle,
      canSelectMany: false,
      defaultUri: folder?.uri,
    });
    if (!picked || picked.length === 0) {
      await vscode.window.showErrorMessage(`No ${displayName} selected.`);
      return undefined;
    }
    resolvedPath = picked[0].fsPath;
  }

  if (!(await isFile(resolvedPath))) {
    await vscode.window.showErrorMessage(
      `${capitalize(displayName)} '${resolvedPath}' does not exist.`,
    );
    return undefined;
  }

  return resolvedPath;
}

/**
 * Picks a `kdap` "attach" launch configuration and starts it against a core
 * file, prompting for the core file and/or program when the configuration
 * doesn't already specify them.
 */
export async function loadCoreFile(): Promise<void> {
  const candidates = findKdapLaunchConfigurations("attach");
  const picked = await pickLaunchConfiguration(candidates);
  if (!picked) {
    if (candidates.length === 0) {
      await vscode.window.showErrorMessage(
        "No 'kdap' launch configuration of type 'attach' found in launch.json.",
      );
    }
    return;
  }

  const coreFile = await resolvePathProperty(
    "coreFile",
    "core file",
    "Select core file",
    picked.config,
    picked.folder,
  );
  if (!coreFile) {
    return;
  }

  const program = await resolvePathProperty(
    "program",
    "program",
    "Select program",
    picked.config,
    picked.folder,
  );
  if (!program) {
    return;
  }

  const config: vscode.DebugConfiguration = {
    ...picked.config,
    coreFile,
    program,
  };
  await vscode.debug.startDebugging(picked.folder, config);
}
