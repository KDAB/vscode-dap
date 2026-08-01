// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as fs from "node:fs/promises";
import * as path from "path";
import * as vscode from "vscode";

export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.X_OK);
  } catch {
    return false;
  }
  return true;
}

async function findGdbInPath(): Promise<string | undefined> {
  const envPath = process.env["PATH"];
  if (!envPath) {
    return undefined;
  }

  for (const dir of envPath.split(path.delimiter)) {
    const candidate = path.join(dir, "gdb");
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function getGdbPath(
  session: vscode.DebugSession,
): Promise<string | undefined> {
  // Explicit path in the launch configuration takes priority.
  const launchConfigPath = session.configuration["gdbPath"];
  if (typeof launchConfigPath === "string" && launchConfigPath.length !== 0) {
    return launchConfigPath;
  }

  // Then the extension's own setting.
  const config = vscode.workspace.getConfiguration(
    "kdap",
    session.workspaceFolder,
  );
  const configPath = config.get<string>("gdbPath");
  if (configPath && configPath.length !== 0) {
    return configPath;
  }

  // Fall back to searching PATH.
  return findGdbInPath();
}

/**
 * Launches gdb in DAP mode (`gdb -i dap`) for a debug session, resolving
 * which gdb binary to use from the launch configuration, extension settings,
 * or PATH, in that order.
 */
export class GDBDapDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable
{
  dispose() {}

  async createDebugAdapterDescriptor(
    session: vscode.DebugSession,
  ): Promise<vscode.DebugAdapterDescriptor | undefined> {
    const gdbPath = await getGdbPath(session);
    if (!gdbPath || !(await isExecutable(gdbPath))) {
      await GDBDapDescriptorFactory.showGdbNotFoundMessage(gdbPath);
      return undefined;
    }

    const config = vscode.workspace.getConfiguration(
      "kdap",
      session.workspaceFolder,
    );

    const args: string[] = ["-i", "dap"];

    const logPath = config.get<string>("logPath");
    if (logPath) {
      args.push("-iex", `set debug dap-log-file ${logPath}`);
    }

    const logLevel = config.get<number>("logLevel");
    if (logLevel) {
      args.push("-iex", `set debug dap-log-level ${logLevel}`);
    }

    const environment = config.get<{ [key: string]: string }>("environment");
    const options = environment ? { env: { ...environment } } : undefined;

    return new vscode.DebugAdapterExecutable(gdbPath, args, options);
  }

  /** Shows a message box when the gdb executable can't be found. */
  static async showGdbNotFoundMessage(gdbPath?: string) {
    const message = gdbPath
      ? `gdb path '${gdbPath}' is not a valid executable.`
      : "Unable to find gdb. Install GDB 15.2 or later, or set kdap.gdbPath.";
    const openSettingsAction = "Open Settings";
    const choice = await vscode.window.showErrorMessage(
      message,
      openSettingsAction,
    );

    if (choice === openSettingsAction) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "kdap.gdbPath",
      );
    }
  }
}
