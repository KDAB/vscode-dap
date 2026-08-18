// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

interface LaunchConfigCandidate {
  folder: vscode.WorkspaceFolder | undefined;
  config: vscode.DebugConfiguration;
}

/**
 * Splits a string into arguments the way a POSIX shell would, minus any
 * expansion: whitespace separates arguments, quotes may open and close
 * anywhere within one, and adjacent segments concatenate - `--name="two
 * words"` is a single argument.
 *
 * Outside quotes, a backslash escapes the character after it; a trailing one
 * is literal. Inside double quotes it escapes only `"` and `\`, and is
 * literal otherwise, so `"\d+"` keeps its backslash. Single quotes take their
 * contents literally, backslashes included.
 *
 * Throws if the input ends inside a quoted segment.
 */
export function splitArguments(input: string): string[] {
  const args: string[] = [];
  let current = "";
  // Tracked separately from `current`, so that `""` yields an empty argument
  // rather than nothing at all.
  let started = false;
  let quote: '"' | "'" | undefined;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      } else {
        current += char;
      }
    } else if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else if (
        char === "\\" &&
        (input[i + 1] === '"' || input[i + 1] === "\\")
      ) {
        current += input[++i];
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === "\\" && i + 1 < input.length) {
      current += input[++i];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(current);
        current = "";
        started = false;
      }
    } else {
      current += char;
      started = true;
    }
  }

  if (quote !== undefined) {
    throw new Error(
      `Unterminated ${quote === '"' ? "double" : "single"} quote in arguments.`,
    );
  }
  if (started) {
    args.push(current);
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
