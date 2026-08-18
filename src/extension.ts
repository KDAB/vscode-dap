// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { GDBDapDescriptorFactory } from "./debugAdapterFactory";
import { GDBDapConfigurationProvider } from "./debugConfigurationProvider";
import { downloadQtPrettyPrinters } from "./gdbPrettyPrinters";
import { debugWithArgs, runWithArgs } from "./runWithArgs";

export function activate(context: vscode.ExtensionContext) {
  const factory = new GDBDapDescriptorFactory(context);
  context.subscriptions.push(factory);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("kdap", factory),
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "kdap",
      new GDBDapConfigurationProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("kdap.downloadQtPrettyPrinters", () =>
      downloadQtPrettyPrinters(context),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("kdap.runWithArgs", runWithArgs),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("kdap.debugWithArgs", debugWithArgs),
  );
}

export function deactivate() {}
