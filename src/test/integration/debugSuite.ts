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
const objectPath = path.join(fixtureDir, "hello.o");
const programPath = path.join(fixtureDir, "hello");

/**
 * A second build of the same source whose debug info records it under
 * `remappedSourceDir` instead of where it really is, so that a session can
 * only find it again through `sourceFileMap`.
 */
const remappedObjectPath = path.join(fixtureDir, "hello-remapped.o");
const remappedProgramPath = path.join(fixtureDir, "hello-remapped");
const remappedSourceDir = "/kdap-nonexistent/build";

/** A C++ fixture holding an associative container to inspect. */
const mapsSourcePath = path.join(fixtureDir, "maps.cpp");
const mapsObjectPath = path.join(fixtureDir, "maps.o");
const mapsProgramPath = path.join(fixtureDir, "maps");

/**
 * Compiles `sourcePath` and links it into `programPath`, as two separate
 * invocations rather than one `compiler -o programPath sourcePath`. On
 * Darwin, DWARF stays in the object file and the linked binary only gets a
 * debug map pointing back at it; a single combined invocation places that
 * object file under $TMPDIR and deletes it once linking finishes, leaving
 * the binary's debug info unreadable. Splitting the steps keeps the object
 * file alive at `objectPath`, which the linked binary's debug map then
 * points at. A no-op on Linux, where DWARF is embedded in the binary either
 * way.
 */
function buildFixture(
  compiler: string,
  sourcePath: string,
  objectPath: string,
  programPath: string,
  extraCompileArgs: readonly string[] = [],
): void {
  cp.execFileSync(compiler, [
    "-g",
    "-O0",
    ...extraCompileArgs,
    "-c",
    "-o",
    objectPath,
    sourcePath,
  ]);
  cp.execFileSync(compiler, ["-g", "-O0", "-o", programPath, objectPath]);
}

// Line 4 (0-based) is `int sum = a + b;` in hello.c.
const breakpointLine = 3;

// Line 17 (0-based) is the `return` in maps.cpp, where byName is populated.
const mapsBreakpointLine = 16;

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
    suiteSetup(async function () {
      this.timeout(30000);

      if (!(await target.findBinaryInPath())) {
        this.skip();
      }

      buildFixture("gcc", sourcePath, objectPath, programPath);
      buildFixture("gcc", sourcePath, remappedObjectPath, remappedProgramPath, [
        `-fdebug-prefix-map=${fixtureDir}=${remappedSourceDir}`,
      ]);
      buildFixture("g++", mapsSourcePath, mapsObjectPath, mapsProgramPath);
    });

    let testIndex = 0;

    setup(async () => {
      // Opt-in DAP logging, for diagnosing a hang or a mismatch between what
      // the extension sent and what the debugger did with it. Off by default
      // since kdap.logPath has no default of its own to restore afterwards.
      //
      // A fresh path per test: the adapter truncates the file on each new
      // session, so sharing one path across the suite would leave only the
      // last test's session in it.
      const logDir = process.env["KDAP_TEST_DAP_LOG_DIR"];
      if (logDir) {
        testIndex += 1;
        await vscode.workspace
          .getConfiguration("kdap")
          .update(
            "logPath",
            path.join(logDir, `${target.id}-${testIndex}.log`),
            vscode.ConfigurationTarget.Global,
          );
      }
    });

    teardown(async () => {
      vscode.Disposable.from(...disposables).dispose();
      disposables.length = 0;

      // A test that passed already disconnected its own session and removed
      // its own breakpoints; this only matters when it failed or timed out
      // first, since a leaked session or breakpoint would otherwise race the
      // next test's startDebugging.
      const session = vscode.debug.activeDebugSession;
      if (session) {
        try {
          await disconnectAndWait(session);
        } catch {
          // The test already failed; don't mask that with an unrelated
          // disconnect error.
        }
      }

      if (vscode.debug.breakpoints.length !== 0) {
        vscode.debug.removeBreakpoints([...vscode.debug.breakpoints]);
      }
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
    });

    test("an associative container expands to one variable per element", async function () {
      this.timeout(60000);

      // The bug this guards against is a two-element map arriving as four
      // variables, one per half of each key/value pair - what a gdb DAP session
      // does with any "map"-hinted pretty printer unless
      // printers/gdb/kdap_map_hint.py has fixed it up. How the entries are
      // named is the debugger's own business (lldb numbers them, gdb names them
      // after the key), so only their number is asserted.
      const uri = vscode.Uri.file(mapsSourcePath);
      const breakpoint = new vscode.SourceBreakpoint(
        new vscode.Location(uri, new vscode.Position(mapsBreakpointLine, 0)),
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
        name: `${target.displayName} associative container test`,
        program: mapsProgramPath,
        cwd: fixtureDir,
        stopOnEntry: false,
      });
      assert.ok(started, "debug session should start");
      const capturedSession = vscode.debug.activeDebugSession;
      assert.ok(capturedSession, "there should be an active debug session");

      const { threadId } = await stopped;

      const stackTrace = (await capturedSession.customRequest("stackTrace", {
        threadId: threadId!,
      })) as { stackFrames: { id: number }[] };
      const scopes = (await capturedSession.customRequest("scopes", {
        frameId: stackTrace.stackFrames[0].id,
      })) as { scopes: { name: string; variablesReference: number }[] };
      const locals = scopes.scopes.find((scope) =>
        scope.name.toLowerCase().startsWith("local"),
      );
      assert.ok(locals, `${target.displayName} should report a locals scope`);

      const localVariables = (await capturedSession.customRequest("variables", {
        variablesReference: locals.variablesReference,
      })) as { variables: { name: string; variablesReference: number }[] };
      const map = localVariables.variables.find(
        (variable) => variable.name === "byName",
      );
      assert.ok(map, "the locals should include byName");
      assert.ok(
        map.variablesReference > 0,
        `${target.displayName} should report byName as expandable`,
      );

      const elements = (await capturedSession.customRequest("variables", {
        variablesReference: map.variablesReference,
      })) as { variables: { name: string }[] };
      assert.strictEqual(
        elements.variables.length,
        2,
        `${target.displayName} should report one variable per map element, got ${JSON.stringify(
          elements.variables.map((variable) => variable.name),
        )}`,
      );
    });
  });
}
