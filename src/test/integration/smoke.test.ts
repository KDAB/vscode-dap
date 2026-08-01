// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as os from "node:os";
import * as vscode from "vscode";

import { isExecutable } from "../../debugAdapterFactory";

suite("Extension Smoke Tests", () => {
  const extensionId = "KDAB.gdb-dap";

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

  test("isExecutable accepts an executable file", async () => {
    assert.strictEqual(await isExecutable(process.execPath), true);
  });

  test("isExecutable rejects a directory", async () => {
    // A searchable directory passes access(X_OK), so this only holds because
    // isExecutable also requires a regular file.
    assert.strictEqual(await isExecutable(os.tmpdir()), false);
  });

  test("isExecutable rejects a missing path", async () => {
    assert.strictEqual(await isExecutable("/nonexistent/kdap-test/gdb"), false);
  });
});
