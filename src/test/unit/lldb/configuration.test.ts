// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import { applyLldbConfiguration } from "../../../debuggers/lldb/configuration";
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

function apply(
  config: Record<string, unknown>,
  options: Partial<SessionOptions> = {},
  qtPrettyPrintersCommand?: string,
) {
  applyLldbConfiguration(
    config,
    { ...noOptions, ...options },
    qtPrettyPrintersCommand,
  );
  return config;
}

suite("applyLldbConfiguration", () => {
  test("leaves a configuration that asks for nothing alone", () => {
    assert.deepStrictEqual(apply({ program: "/bin/ls" }), {
      program: "/bin/ls",
    });
  });

  test("sourceFileMap becomes lldb-dap's sourceMap pairs", () => {
    assert.deepStrictEqual(
      apply(
        {},
        { sourceFileMap: { "/build/a": "/src/a", "/build/b": "/src/b" } },
      ),
      {
        sourceMap: [
          ["/build/a", "/src/a"],
          ["/build/b", "/src/b"],
        ],
      },
    );
  });

  test("an empty sourceFileMap adds no sourceMap", () => {
    assert.deepStrictEqual(
      apply({ program: "/bin/ls" }, { sourceFileMap: {} }),
      {
        program: "/bin/ls",
      },
    );
  });

  test("env is left untouched", () => {
    // lldb-dap merges "env" into the inherited environment rather than
    // replacing it, so it needs no equivalent of gdb's clear_env workaround.
    assert.deepStrictEqual(apply({ env: { A: "1" } }), { env: { A: "1" } });
  });

  test("an undefined qtPrettyPrintersCommand adds no initCommands", () => {
    assert.deepStrictEqual(apply({ program: "/bin/ls" }), {
      program: "/bin/ls",
    });
  });

  test("a qtPrettyPrintersCommand is added to initCommands", () => {
    assert.deepStrictEqual(
      apply({ program: "/bin/ls" }, {}, "command script import /qt"),
      {
        program: "/bin/ls",
        initCommands: ["command script import /qt"],
      },
    );
  });

  test("a qtPrettyPrintersCommand is appended after the caller's own initCommands", () => {
    assert.deepStrictEqual(
      apply(
        { initCommands: ["platform select remote-linux"] },
        {},
        "command script import /qt",
      ),
      {
        initCommands: [
          "platform select remote-linux",
          "command script import /qt",
        ],
      },
    );
  });
});
