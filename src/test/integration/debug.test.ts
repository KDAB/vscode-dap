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

/** Registrations to undo after each test, even one that failed or timed out. */
const disposables: vscode.Disposable[] = [];

/**
 * Resolves with the body of the first matching DAP event sent by a `kdap`
 * adapter.
 */
function waitForDapEvent<T>(
  event: string,
  isMatch: (body: T) => boolean,
): Promise<T> {
  return new Promise<T>((resolve) => {
    disposables.push(
      vscode.debug.registerDebugAdapterTrackerFactory("kdap", {
        createDebugAdapterTracker() {
          return {
            onDidSendMessage(message: {
              type: string;
              event?: string;
              body?: T;
            }) {
              if (
                message.type === "event" &&
                message.event === event &&
                message.body !== undefined &&
                isMatch(message.body)
              ) {
                resolve(message.body);
              }
            },
          };
        },
      }),
    );
  });
}

/**
 * Disconnects a session and waits for it to fully terminate, so the next
 * test's startDebugging doesn't race the previous session's teardown.
 */
async function disconnectAndWait(session: vscode.DebugSession): Promise<void> {
  const terminated = new Promise<void>((resolve) => {
    const subscription = vscode.debug.onDidTerminateDebugSession((s) => {
      if (s.id === session.id) {
        subscription.dispose();
        resolve();
      }
    });
  });
  await session.customRequest("disconnect", { terminateDebuggee: true });
  await terminated;
}

suite("GDB DAP debugging", () => {
  suiteSetup(function () {
    this.timeout(30000);
    cp.execFileSync("gcc", ["-g", "-O0", "-o", programPath, sourcePath]);
  });

  teardown(() => {
    vscode.Disposable.from(...disposables).dispose();
    disposables.length = 0;
  });

  test("stops at a breakpoint set on the inferior", async function () {
    this.timeout(60000);

    const uri = vscode.Uri.file(sourcePath);
    const breakpoint = new vscode.SourceBreakpoint(
      new vscode.Location(uri, new vscode.Position(breakpointLine, 0)),
    );
    vscode.debug.addBreakpoints([breakpoint]);

    let capturedSession: vscode.DebugSession | undefined;
    const stopped = waitForDapEvent<{ reason?: string; threadId?: number }>(
      "stopped",
      (body) => body.reason === "breakpoint",
    );

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
      threadId: threadId!,
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

    await disconnectAndWait(capturedSession);

    vscode.debug.removeBreakpoints([breakpoint]);
  });
});
