// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as cp from "child_process";
import * as fs from "node:fs/promises";
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
  suiteSetup(async function () {
    this.timeout(30000);
    cp.execFileSync("gcc", ["-g", "-O0", "-o", programPath, sourcePath]);

    // Otherwise starting a session on a machine without the printers pops a
    // modal offering to download them, which nothing here would ever answer.
    await vscode.workspace
      .getConfiguration("kdap")
      .update("qtPrettyPrinters", false, vscode.ConfigurationTarget.Global);
  });

  suiteTeardown(async () => {
    await vscode.workspace
      .getConfiguration("kdap")
      .update("qtPrettyPrinters", undefined, vscode.ConfigurationTarget.Global);
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
    const capturedSession = vscode.debug.activeDebugSession;
    assert.ok(capturedSession, "there should be an active debug session");

    const { threadId } = await stopped;

    // customRequest is typed as Thenable<any>, so name the bits we use.
    const stackTrace = (await capturedSession.customRequest("stackTrace", {
      threadId: threadId!,
    })) as { stackFrames: { id: number }[] };
    const frameId = stackTrace.stackFrames[0].id;

    const evaluated = (await capturedSession.customRequest("evaluate", {
      expression: "a + b",
      frameId,
      context: "watch",
    })) as { result: string };
    assert.strictEqual(
      evaluated.result,
      "5",
      "gdb should evaluate 'a + b' as 5 inside add()",
    );

    await disconnectAndWait(capturedSession);

    vscode.debug.removeBreakpoints([breakpoint]);
  });

  test("launch config's env is merged into, not replacing, the inferior's environment", async function () {
    this.timeout(60000);

    const processStarted = waitForDapEvent<{ systemProcessId?: number }>(
      "process",
      (body) => body.systemProcessId !== undefined,
    );

    const started = await vscode.debug.startDebugging(undefined, {
      type: "kdap",
      request: "launch",
      name: "GDB DAP env merge test",
      program: programPath,
      cwd: fixtureDir,
      stopOnEntry: true,
      env: { KDAP_TEST_VAR: "hello" },
    });
    assert.ok(started, "debug session should start");
    const capturedSession = vscode.debug.activeDebugSession;
    assert.ok(capturedSession, "there should be an active debug session");

    const { systemProcessId } = await processStarted;

    // Read the inferior's real environment directly, rather than via gdb's
    // "evaluate", since calling getenv() through evaluate makes gdb emit a
    // spurious DAP "continued" event partway through the call.
    const environ = await fs.readFile(
      `/proc/${systemProcessId}/environ`,
      "utf8",
    );
    const inferiorEnv = new Set(environ.split("\0").filter(Boolean));

    assert.ok(
      inferiorEnv.has("KDAP_TEST_VAR=hello"),
      "the env var set in the launch config should reach the inferior",
    );
    assert.ok(
      inferiorEnv.has(`PATH=${process.env["PATH"]}`),
      "PATH should be inherited unchanged even though the launch config set env",
    );

    await disconnectAndWait(capturedSession);
  });
});
