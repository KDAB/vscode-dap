// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Smoke Tests", () => {
  const extensionId = "KDAB.dap";

  test("extension is present", () => {
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, `Extension ${extensionId} should be installed`);
  });

  test("extension activates successfully", async () => {
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test("configuration keys are declared", () => {
    const config = vscode.workspace.getConfiguration("kdap");
    const logLevel = config.inspect("logLevel");
    assert.ok(logLevel, "kdap.logLevel should be declared");
    assert.strictEqual(
      logLevel?.defaultValue,
      1,
      "logLevel default should be 1",
    );
  });
});
