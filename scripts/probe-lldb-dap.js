#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Speaks raw DAP to an lldb-dap binary, with no VS Code involved. This exists
// to tell apart two very different bugs behind the same symptom - the
// integration suite's "Debugging with lldb-dap" tests timing out with no DAP
// activity at all:
//
//   - lldb-dap itself hangs on this machine (a ptrace/sandbox restriction, a
//     missing shared library, something specific to the CI image) - this
//     script hangs too, and says on which request.
//   - Something about VS Code's extension host or debug adapter tracker on
//     this machine is what hangs - this script finishes in well under a
//     second and the bug is elsewhere.
//
// Usage: node scripts/probe-lldb-dap.js [lldb-dap-binary] [timeout-ms]

const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BIN = process.argv[2] || "lldb-dap";
const TIMEOUT_MS = Number(process.argv[3]) || 20000;

function log(...args) {
  console.log(`[probe]`, ...args);
}

function fail(message) {
  console.error(`[probe] FAIL: ${message}`);
  process.exitCode = 1;
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "kdap-probe-"));
const sourcePath = path.join(workDir, "hello.c");
const programPath = path.join(workDir, "hello");
fs.writeFileSync(
  sourcePath,
  [
    "#include <stdio.h>",
    "int main(void) {",
    '  printf("hello\\n");',
    "  return 0;",
    "}",
    "",
  ].join("\n"),
);
cp.execFileSync("gcc", ["-g", "-O0", "-o", programPath, sourcePath]);
log("built", programPath);

log("spawning", BIN);
const child = cp.spawn(BIN, [], { stdio: ["pipe", "pipe", "pipe"] });
child.on("error", (error) => {
  clearTimeout(watchdog);
  fail(`could not spawn ${BIN}: ${error.message}`);
  process.exit(1);
});

let seq = 0;
const pending = new Map();
const events = [];
let outstandingRequest;

function send(command, args) {
  seq += 1;
  const thisSeq = seq;
  outstandingRequest = `${command} (seq ${thisSeq})`;
  log("-->", outstandingRequest, JSON.stringify(args ?? {}));
  const body = JSON.stringify({
    seq: thisSeq,
    type: "request",
    command,
    arguments: args,
  });
  child.stdin.write(
    `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
  return new Promise((resolve) => pending.set(thisSeq, resolve));
}

let buffer = Buffer.alloc(0);
child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.subarray(0, headerEnd).toString();
    const match = /Content-Length: (\d+)/i.exec(header);
    if (!match) return;
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const message = JSON.parse(
      buffer.subarray(start, start + length).toString(),
    );
    buffer = buffer.subarray(start + length);

    if (message.type === "response") {
      log("<--", message.command, "success:", message.success, message.message || "");
      const resolve = pending.get(message.request_seq);
      if (resolve) {
        pending.delete(message.request_seq);
        outstandingRequest = undefined;
        resolve(message);
      }
    } else if (message.type === "event") {
      log("<-- event:", message.event, JSON.stringify(message.body ?? {}));
      events.push(message);
    }
  }
});

const stderrLines = [];
child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  stderrLines.push(text);
  log("stderr:", text.trimEnd());
});

child.on("exit", (code, signal) => {
  log("process exited, code:", code, "signal:", signal);
});

function waitForEvent(name, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const found = events.find((e) => e.event === name);
      if (found) return resolve(found);
      if (Date.now() > deadline)
        return reject(new Error(`timed out waiting for "${name}" event`));
      setTimeout(tick, 50);
    };
    tick();
  });
}

const watchdog = setTimeout(() => {
  fail(
    `overall timeout of ${TIMEOUT_MS}ms exceeded` +
      (outstandingRequest
        ? `, still waiting on: ${outstandingRequest}`
        : ", stuck waiting for an event"),
  );
  log("stderr collected so far:", stderrLines.join("") || "(none)");
  child.kill("SIGKILL");
  process.exit(1);
}, TIMEOUT_MS);

(async () => {
  const init = await send("initialize", {
    adapterID: "lldb-dap",
    clientID: "probe",
    linesStartAt1: true,
    columnsStartAt1: true,
    pathFormat: "path",
    supportsRunInTerminalRequest: false,
  });
  if (!init.success) throw new Error(`initialize failed: ${init.message}`);

  const launch = await send("launch", {
    program: programPath,
    stopOnEntry: false,
  });
  if (!launch.success) throw new Error(`launch failed: ${launch.message}`);

  await send("configurationDone", {});

  const processEvent = await waitForEvent(
    "process",
    Math.max(1000, TIMEOUT_MS - 2000),
  );
  log("got process event, pid:", processEvent.body.systemProcessId);

  await waitForEvent("exited", Math.max(1000, TIMEOUT_MS - 2000)).catch(
    () => log("(no exited event within budget, disconnecting anyway)"),
  );

  await send("disconnect", { terminateDebuggee: true });
  clearTimeout(watchdog);
  log("PASS");
  child.kill();
  process.exit(0);
})().catch((error) => {
  clearTimeout(watchdog);
  fail(error.message);
  log("stderr collected so far:", stderrLines.join("") || "(none)");
  child.kill("SIGKILL");
  process.exit(1);
});
