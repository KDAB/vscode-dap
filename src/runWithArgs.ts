// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { splitArguments } from "./argumentSplitter";
import {
  findKdapLaunchConfigurations,
  pickLaunchConfiguration,
} from "./launchConfigPicker";

/** Prompts for arguments, then starts `config` with them, either running or debugging depending on `noDebug`. */
async function runOrDebugWithArgs(noDebug: boolean): Promise<void> {
  const candidates = findKdapLaunchConfigurations("launch");
  const picked = await pickLaunchConfiguration(candidates);
  if (!picked) {
    if (candidates.length === 0) {
      await vscode.window.showErrorMessage(
        "No 'kdap' launch configuration found in launch.json.",
      );
    }
    return;
  }

  const input = await vscode.window.showInputBox({
    prompt: "Arguments",
    placeHolder: 'e.g. --foo bar "quoted value"',
  });
  if (input === undefined) {
    return;
  }

  let args: string[];
  try {
    args = splitArguments(input);
  } catch (error) {
    await vscode.window.showErrorMessage(
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  const config: vscode.DebugConfiguration = { ...picked.config, args };
  if (noDebug) {
    // gdb's DAP launch handler doesn't know about "noDebug", so it would still
    // honour these and stop the inferior - with only Stop and Restart in the
    // toolbar, leaving no way to continue.
    delete config["stopOnEntry"];
    delete config["stopAtBeginningOfMainSubprogram"];
  }

  await vscode.debug.startDebugging(picked.folder, config, { noDebug });
}

export function runWithArgs(): Promise<void> {
  return runOrDebugWithArgs(true);
}

export function debugWithArgs(): Promise<void> {
  return runOrDebugWithArgs(false);
}
