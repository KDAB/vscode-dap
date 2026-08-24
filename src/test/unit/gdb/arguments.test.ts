// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import {
  buildGdbArgs,
  buildMapHintArgs,
} from "../../../debuggers/gdb/arguments";
import { SessionOptions } from "../../../sessionOptions";

const noOptions: SessionOptions = {
  skipInitFiles: false,
  sysroot: undefined,
  sourceFileMap: {},
  logPath: undefined,
  logLevel: undefined,
  qtPrettyPrinters: false,
  environment: undefined,
};

function build(
  options: Partial<SessionOptions> = {},
  pythonArgs: string[] = [],
) {
  return buildGdbArgs({ ...noOptions, ...options }, pythonArgs);
}

suite("buildGdbArgs", () => {
  test("always puts gdb into quiet DAP mode", () => {
    assert.deepStrictEqual(build(), ["-q", "-i", "dap"]);
  });

  test("skipInitFiles becomes -nx", () => {
    assert.deepStrictEqual(build({ skipInitFiles: true }), [
      "-q",
      "-i",
      "dap",
      "-nx",
    ]);
  });

  test("sysroot becomes an -iex set sysroot", () => {
    assert.deepStrictEqual(build({ sysroot: "/opt/sysroot" }), [
      "-q",
      "-i",
      "dap",
      "-iex",
      "set sysroot /opt/sysroot",
    ]);
  });

  test("each sourceFileMap entry becomes its own set substitute-path", () => {
    assert.deepStrictEqual(
      build({ sourceFileMap: { "/build/a": "/src/a", "/build/b": "/src/b" } }),
      [
        "-q",
        "-i",
        "dap",
        "-iex",
        "set substitute-path /build/a /src/a",
        "-iex",
        "set substitute-path /build/b /src/b",
      ],
    );
  });

  test("logPath enables the DAP log", () => {
    assert.deepStrictEqual(build({ logPath: "/tmp/dap.log" }), [
      "-q",
      "-i",
      "dap",
      "-iex",
      "set debug dap-log-file /tmp/dap.log",
    ]);
  });

  test("logLevel is passed alongside the log file", () => {
    assert.deepStrictEqual(build({ logPath: "/tmp/dap.log", logLevel: 2 }), [
      "-q",
      "-i",
      "dap",
      "-iex",
      "set debug dap-log-file /tmp/dap.log",
      "-iex",
      "set debug dap-log-level 2",
    ]);
  });

  test("logLevel alone is not passed", () => {
    // gdb rejects dap-log-level while logging is off, so it must only ever
    // appear together with dap-log-file.
    assert.deepStrictEqual(build({ logLevel: 2 }), ["-q", "-i", "dap"]);
  });

  test("python arguments come last", () => {
    assert.deepStrictEqual(
      build({ skipInitFiles: true, sysroot: "/opt/sysroot" }, [
        "-iex",
        "python pass",
      ]),
      [
        "-q",
        "-i",
        "dap",
        "-nx",
        "-iex",
        "set sysroot /opt/sysroot",
        "-iex",
        "python pass",
      ],
    );
  });

  test("everything at once keeps -nx before any -iex", () => {
    // -nx has to precede the init commands it suppresses.
    assert.deepStrictEqual(
      build(
        {
          skipInitFiles: true,
          sysroot: "/opt/sysroot",
          sourceFileMap: { "/build": "/src" },
          logPath: "/tmp/dap.log",
          logLevel: 1,
        },
        ["-iex", "python pass"],
      ),
      [
        "-q",
        "-i",
        "dap",
        "-nx",
        "-iex",
        "set sysroot /opt/sysroot",
        "-iex",
        "set substitute-path /build /src",
        "-iex",
        "set debug dap-log-file /tmp/dap.log",
        "-iex",
        "set debug dap-log-level 1",
        "-iex",
        "python pass",
      ],
    );
  });
});

suite("buildMapHintArgs", () => {
  test("imports the fixup from the given directory and installs it", () => {
    assert.deepStrictEqual(buildMapHintArgs("/ext/printers/gdb"), [
      "-iex",
      'python import sys; sys.path.insert(0, "/ext/printers/gdb"); import kdap_map_hint; kdap_map_hint.install()',
    ]);
  });

  test("quotes a directory containing spaces or quotes", () => {
    // The path lands inside a Python expression, so it has to be a Python
    // literal rather than pasted in raw.
    assert.deepStrictEqual(buildMapHintArgs('/ext dir/with"quote'), [
      "-iex",
      'python import sys; sys.path.insert(0, "/ext dir/with\\"quote"); import kdap_map_hint; kdap_map_hint.install()',
    ]);
  });
});
