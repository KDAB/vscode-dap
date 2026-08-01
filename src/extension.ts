// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { GDBDapDescriptorFactory } from "./debugAdapterFactory";

export function activate(context: vscode.ExtensionContext) {
  const factory = new GDBDapDescriptorFactory();
  context.subscriptions.push(factory);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("kdap", factory),
  );
}

export function deactivate() {}
