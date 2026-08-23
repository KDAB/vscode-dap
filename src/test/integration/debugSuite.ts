// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as cp from "child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "path";
import * as vscode from "vscode";

import { DebuggerBackend } from "../../debuggers/backend";

const fixtureDir = path.join(__dirname, "..", "..", "..", "test", "fixtures");
const sourcePath = path.join(fixtureDir, "hello.c");
const programPath = path.join(fixtureDir, "hello");

/**
 * A second build of the same source whose debug info records it under
 * `remappedSourceDir` instead of where it really is, so that a session can
 * only find it again through `sourceFileMap`.
 */
const remappedProgramPath = path.join(fixtureDir, "hello-remapped");
const remappedSourceDir = "/kdap-nonexistent/build";

// Line 4 (0-based) is `int sum = a + b;` in hello.c.
const breakpointLine = 3;

/** Registrations to undo after each test, even one that failed or timed out. */
const disposables: vscode.Disposable[] = [];

/**
 * Resolves with the body of the first matching DAP event sent by an adapter of
 * `debugType`.
 */
function waitForDapEvent<T>(
  debugType: string,
  event: string,
  isMatch: (body: T) => boolean,
): Promise<T> {
  return new Promise<T>((resolve) => {
    disposables.push(
      vscode.debug.registerDebugAdapterTrackerFactory(debugType, {
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

/**
 * Defines the debugging integration suite for one debugger. Everything here is
 * a promise the extension makes to its users regardless of which debugger is
 * behind it, so the assertions are the same for all of them: making them hold
 * on a new debugger is the extension's job, not the test's.
 */
export function defineDebugSuite(target: DebuggerBackend) {
  suite(`Debugging with ${target.displayName}`, () => {
    /**
     * Whether this debugger has a Qt pretty printer setting at all. Only gdb
     * does, and updating a setting VS Code doesn't know about throws, so this
     * is asked of the configuration rather than assumed per debugger.
     */
    function qtPrettyPrintersSetting() {
      const config = vscode.workspace.getConfiguration(`kdap.${target.id}`);
      // inspect() answers for unregistered keys too, with every field
      // undefined, so a declared default is what distinguishes them.
      const declared =
        config.inspect("qtPrettyPrinters")?.defaultValue !== undefined;
      return declared ? config : undefined;
    }

    suiteSetup(async function () {
      this.timeout(30000);

      if (!(await target.findBinaryInPath())) {
        this.skip();
      }

      cp.execFileSync("gcc", ["-g", "-O0", "-o", programPath, sourcePath]);
      cp.execFileSync("gcc", [
        "-g",
        "-O0",
        `-fdebug-prefix-map=${fixtureDir}=${remappedSourceDir}`,
        "-o",
        remappedProgramPath,
        sourcePath,
      ]);

      // Otherwise starting a session on a machine without the printers pops a
      // modal offering to download them, which nothing here would ever answer.
      await qtPrettyPrintersSetting()?.update(
        "qtPrettyPrinters",
        false,
        vscode.ConfigurationTarget.Global,
      );

      // Opt-in DAP logging, for diagnosing a hang or a mismatch between what
      // the extension sent and what the debugger did with it. Off by default
      // since kdap.logPath has no default of its own to restore afterwards.
      const logDir = process.env["KDAP_TEST_DAP_LOG_DIR"];
      if (logDir) {
        await vscode.workspace
          .getConfiguration("kdap")
          .update(
            "logPath",
            path.join(logDir, `${target.id}.log`),
            vscode.ConfigurationTarget.Global,
          );
      }
    });

    suiteTeardown(async () => {
      await qtPrettyPrintersSetting()?.update(
        "qtPrettyPrinters",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      if (process.env["KDAP_TEST_DAP_LOG_DIR"]) {
        await vscode.workspace
          .getConfiguration("kdap")
          .update("logPath", undefined, vscode.ConfigurationTarget.Global);
      }
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
        target.debugType,
        "stopped",
        (body) => body.reason === "breakpoint",
      );

      const started = await vscode.debug.startDebugging(undefined, {
        type: target.debugType,
        request: "launch",
        name: `${target.displayName} smoke test`,
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
        `${target.displayName} should evaluate 'a + b' as 5 inside add()`,
      );

      await disconnectAndWait(capturedSession);

      vscode.debug.removeBreakpoints([breakpoint]);
    });

    test("launch config's env is merged into, not replacing, the inferior's environment", async function () {
      this.timeout(60000);

      const processStarted = waitForDapEvent<{ systemProcessId?: number }>(
        target.debugType,
        "process",
        (body) => body.systemProcessId !== undefined,
      );

      const started = await vscode.debug.startDebugging(undefined, {
        type: target.debugType,
        request: "launch",
        name: `${target.displayName} env merge test`,
        program: programPath,
        cwd: fixtureDir,
        stopOnEntry: true,
        env: { KDAP_TEST_VAR: "hello" },
      });
      assert.ok(started, "debug session should start");
      const capturedSession = vscode.debug.activeDebugSession;
      assert.ok(capturedSession, "there should be an active debug session");

      const { systemProcessId } = await processStarted;

      // Read the inferior's real environment directly, rather than via the
      // debugger's "evaluate", since calling getenv() through evaluate makes
      // gdb emit a spurious DAP "continued" event partway through the call.
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

    test("sourceFileMap points the debugger back at a moved source tree", async function () {
      this.timeout(60000);

      const uri = vscode.Uri.file(sourcePath);
      const breakpoint = new vscode.SourceBreakpoint(
        new vscode.Location(uri, new vscode.Position(breakpointLine, 0)),
      );
      vscode.debug.addBreakpoints([breakpoint]);

      const stopped = waitForDapEvent<{ reason?: string; threadId?: number }>(
        target.debugType,
        "stopped",
        (body) => body.reason === "breakpoint",
      );

      const started = await vscode.debug.startDebugging(undefined, {
        type: target.debugType,
        request: "launch",
        name: `${target.displayName} sourceFileMap test`,
        program: remappedProgramPath,
        // Deliberately not fixtureDir: with the source sitting in the working
        // directory, both debuggers find it by basename and the mapping isn't
        // what makes the test pass.
        cwd: os.tmpdir(),
        stopOnEntry: false,
        sourceFileMap: { [remappedSourceDir]: fixtureDir },
      });
      assert.ok(started, "debug session should start");
      const capturedSession = vscode.debug.activeDebugSession;
      assert.ok(capturedSession, "there should be an active debug session");

      const { threadId } = await stopped;

      const stackTrace = (await capturedSession.customRequest("stackTrace", {
        threadId: threadId!,
      })) as { stackFrames: { source?: { path?: string } }[] };

      // Without the mapping this is the recorded path under
      // /kdap-nonexistent/build, which no editor could open.
      assert.strictEqual(
        stackTrace.stackFrames[0].source?.path,
        sourcePath,
        `${target.displayName} should report the mapped source path`,
      );

      await disconnectAndWait(capturedSession);

      vscode.debug.removeBreakpoints([breakpoint]);
    });
  });
}
