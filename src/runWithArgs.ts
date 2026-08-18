// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

interface LaunchConfigCandidate {
  folder: vscode.WorkspaceFolder | undefined;
  config: vscode.DebugConfiguration;
}

/**
 * Splits a string into shell-like argument tokens: double-quoted segments
 * (with `\"` and `\\` recognised inside them), single-quoted segments taken
 * literally, and whitespace-separated bare words.
 */
export function splitArguments(input: string): string[] {
  const regex = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  const args: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) {
      args.push(match[1].replace(/\\(.)/g, "$1"));
    } else if (match[2] !== undefined) {
      args.push(match[2]);
    } else {
      args.push(match[3]);
    }
  }
  return args;
}

/** Every `kdap` launch configuration across all workspace folders (or the single implicit folder when there's no workspace). */
function findKdapLaunchConfigurations(): LaunchConfigCandidate[] {
  const folders = vscode.workspace.workspaceFolders ?? [undefined];
  const candidates: LaunchConfigCandidate[] = [];
  for (const folder of folders) {
    const configurations = vscode.workspace
      .getConfiguration("launch", folder)
      .get<vscode.DebugConfiguration[]>("configurations", []);
    for (const config of configurations) {
      if (config["type"] === "kdap" && config["request"] === "launch") {
        candidates.push({ folder, config });
      }
    }
  }
  return candidates;
}

/** Picks a `kdap` launch configuration, prompting the user only when there's more than one to choose from. */
async function pickLaunchConfiguration(): Promise<
  LaunchConfigCandidate | undefined
> {
  const candidates = findKdapLaunchConfigurations();
  if (candidates.length === 0) {
    await vscode.window.showErrorMessage(
      "No 'kdap' launch configuration found in launch.json.",
    );
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const multipleFolders =
    new Set(candidates.map((candidate) => candidate.folder)).size > 1;
  const picked = await vscode.window.showQuickPick(
    candidates.map((candidate) => ({
      label: candidate.config["name"],
      description: multipleFolders ? candidate.folder?.name : undefined,
      candidate,
    })),
    { placeHolder: "Select a launch configuration" },
  );
  return picked?.candidate;
}

/** Prompts for arguments, then starts `config` with them, either running or debugging depending on `noDebug`. */
async function runOrDebugWithArgs(noDebug: boolean): Promise<void> {
  const picked = await pickLaunchConfiguration();
  if (!picked) {
    return;
  }

  const input = await vscode.window.showInputBox({
    prompt: "Arguments",
    placeHolder: 'e.g. --foo bar "quoted value"',
  });
  if (input === undefined) {
    return;
  }

  const config: vscode.DebugConfiguration = {
    ...picked.config,
    args: splitArguments(input),
  };
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
