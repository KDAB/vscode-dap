// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import { buildLldbAdapterCommand } from "../../../debuggers/lldb/arguments";
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

function build(options: Partial<SessionOptions> = {}) {
  return buildLldbAdapterCommand({ ...noOptions, ...options });
}

suite("buildLldbAdapterCommand", () => {
  test("passes no arguments at all by default", () => {
    // lldb-dap speaks DAP over stdio with no flags, unlike gdb's -i dap.
    assert.deepStrictEqual(build(), { args: [], env: {}, unsupported: [] });
  });

  test("logPath becomes the LLDBDAP_LOG environment variable", () => {
    assert.deepStrictEqual(build({ logPath: "/tmp/dap.log" }).env, {
      LLDBDAP_LOG: "/tmp/dap.log",
    });
  });

  test("logLevel is not reported as unsupported, having no lldb setting to reach", () => {
    // kdap.lldb.logLevel isn't contributed, so it can never be set.
    assert.deepStrictEqual(
      build({ logPath: "/tmp/dap.log", logLevel: 2 }).unsupported,
      [],
    );
  });

  test("sysroot is reported as unsupported", () => {
    assert.deepStrictEqual(build({ sysroot: "/opt/sysroot" }).unsupported, [
      "sysroot",
    ]);
  });

  test("skipInitFiles is reported as unsupported", () => {
    // lldb-dap sources ~/.lldbinit unconditionally and its sourceInitFile
    // launch argument does not suppress that.
    assert.deepStrictEqual(build({ skipInitFiles: true }).unsupported, [
      "skipInitFiles",
    ]);
  });

  test("nothing is reported as unsupported when nothing was asked for", () => {
    assert.deepStrictEqual(
      build({ sourceFileMap: { "/a": "/b" } }).unsupported,
      [
        // sourceFileMap is honoured, just via the launch configuration.
      ],
    );
  });

  test("several unsupported options are all reported", () => {
    assert.deepStrictEqual(
      build({ sysroot: "/opt/sysroot", skipInitFiles: true }).unsupported,
      ["sysroot", "skipInitFiles"],
    );
  });
});
