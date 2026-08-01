// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";

const fixtureDir = path.join(__dirname, "..", "..", "..", "test", "fixtures");
const sourcePath = path.join(fixtureDir, "hello.c");
const programPath = path.join(fixtureDir, "hello");

// Line 4 (0-based) is `int sum = a + b;` in hello.c.
const breakpointLine = 3;

suite("GDB DAP debugging", () => {
  suiteSetup(function () {
    this.timeout(30000);
    cp.execFileSync("gcc", ["-g", "-O0", "-o", programPath, sourcePath]);
  });

  test("stops at a breakpoint set on the inferior", async function () {
    this.timeout(60000);

    const uri = vscode.Uri.file(sourcePath);
    const breakpoint = new vscode.SourceBreakpoint(
      new vscode.Location(uri, new vscode.Position(breakpointLine, 0)),
    );
    vscode.debug.addBreakpoints([breakpoint]);

    let capturedSession: vscode.DebugSession | undefined;
    const stopped = new Promise<{ threadId: number }>((resolve) => {
      const trackerRegistration =
        vscode.debug.registerDebugAdapterTrackerFactory("kdap", {
          createDebugAdapterTracker() {
            return {
              onDidSendMessage(message: {
                type: string;
                event?: string;
                body?: { reason?: string; threadId?: number };
              }) {
                if (
                  message.type === "event" &&
                  message.event === "stopped" &&
                  message.body?.reason === "breakpoint"
                ) {
                  trackerRegistration.dispose();
                  resolve({ threadId: message.body.threadId! });
                }
              },
            };
          },
        });
    });

    const started = await vscode.debug.startDebugging(undefined, {
      type: "kdap",
      request: "launch",
      name: "GDB DAP smoke test",
      program: programPath,
      cwd: fixtureDir,
      stopOnEntry: false,
    });
    assert.ok(started, "debug session should start");
    capturedSession = vscode.debug.activeDebugSession;
    assert.ok(capturedSession, "there should be an active debug session");

    const { threadId } = await stopped;

    const stackTrace = await capturedSession.customRequest("stackTrace", {
      threadId,
    });
    const frameId = stackTrace.stackFrames[0].id;

    const evaluated = await capturedSession.customRequest("evaluate", {
      expression: "a + b",
      frameId,
      context: "watch",
    });
    assert.strictEqual(
      evaluated.result,
      "5",
      "gdb should evaluate 'a + b' as 5 inside add()",
    );

    await capturedSession.customRequest("disconnect", {
      terminateDebuggee: true,
    });

    vscode.debug.removeBreakpoints([breakpoint]);
  });
});
