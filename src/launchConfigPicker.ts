// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { debugTypes } from "./debuggers/registry";

export interface LaunchConfigCandidate {
  folder: vscode.WorkspaceFolder | undefined;
  config: vscode.DebugConfiguration;
}

/** Every launch configuration of one of this extension's debug types with the given `request`, across all workspace folders (or the single implicit folder when there's no workspace). */
export function findKdapLaunchConfigurations(
  request: "launch" | "attach",
): LaunchConfigCandidate[] {
  const folders = vscode.workspace.workspaceFolders ?? [undefined];
  const candidates: LaunchConfigCandidate[] = [];
  for (const folder of folders) {
    const configurations = vscode.workspace
      .getConfiguration("launch", folder)
      .get<vscode.DebugConfiguration[]>("configurations", []);
    for (const config of configurations) {
      if (
        debugTypes.includes(config["type"]) &&
        config["request"] === request
      ) {
        candidates.push({ folder, config });
      }
    }
  }
  return candidates;
}

/**
 * Picks one of `candidates`, prompting the user only when there's more than
 * one to choose from. Returns undefined both when `candidates` is empty and
 * when the user cancels the picker; callers distinguish the two by checking
 * `candidates.length` themselves.
 */
export async function pickLaunchConfiguration(
  candidates: LaunchConfigCandidate[],
): Promise<LaunchConfigCandidate | undefined> {
  if (candidates.length === 0) {
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
