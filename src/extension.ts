// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from "vscode";

import { DapDescriptorFactory } from "./debugAdapterFactory";
import { DapConfigurationProvider } from "./debugConfigurationProvider";
import { downloadQtPrettyPrinters } from "./debuggers/gdb/prettyPrinters";
import { backends } from "./debuggers/registry";
import { loadCoreFile } from "./loadCoreFile";
import { debugWithArgs, runWithArgs } from "./runWithArgs";

export function activate(context: vscode.ExtensionContext) {
  for (const backend of backends) {
    const factory = new DapDescriptorFactory(backend, context);
    context.subscriptions.push(factory);
    context.subscriptions.push(
      vscode.debug.registerDebugAdapterDescriptorFactory(
        backend.debugType,
        factory,
      ),
    );
    context.subscriptions.push(
      vscode.debug.registerDebugConfigurationProvider(
        backend.debugType,
        new DapConfigurationProvider(backend),
      ),
    );
  }

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
  context.subscriptions.push(
    vscode.commands.registerCommand("kdap.loadCoreFile", loadCoreFile),
  );
}

export function deactivate() {}
