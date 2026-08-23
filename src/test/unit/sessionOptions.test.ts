// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as os from "node:os";
import * as path from "path";

import { LaunchConfiguration, parseSessionOptions } from "../../sessionOptions";
import { KdapSettings } from "../../settings";

/** The settings as they come out of readSettings() with nothing configured. */
const defaultSettings: KdapSettings = {
  debuggerPath: undefined,
  logPath: undefined,
  logLevel: undefined,
  environment: undefined,
  qtPrettyPrinters: false,
};

function parse(
  config: LaunchConfiguration,
  settings: Partial<KdapSettings> = {},
) {
  return parseSessionOptions(config, { ...defaultSettings, ...settings });
}

suite("parseSessionOptions", () => {
  test("an empty configuration asks for nothing", () => {
    assert.deepStrictEqual(parse({}), {
      skipInitFiles: false,
      sysroot: undefined,
      sourceFileMap: {},
      logPath: undefined,
      logLevel: undefined,
      qtPrettyPrinters: false,
    });
  });

  test("skipGdbinit is only honoured when it really is true", () => {
    assert.strictEqual(parse({ skipGdbinit: true }).skipInitFiles, true);
    assert.strictEqual(parse({ skipGdbinit: false }).skipInitFiles, false);
    // launch.json is JSON, so a string here is a user mistake rather than
    // something to coerce.
    assert.strictEqual(parse({ skipGdbinit: "true" }).skipInitFiles, false);
  });

  test("sysroot has a leading ~ expanded", () => {
    assert.strictEqual(
      parse({ sysroot: "~/sysroots/arm" }).sysroot,
      path.join(os.homedir(), "sysroots", "arm"),
    );
  });

  test("an empty or non-string sysroot counts as absent", () => {
    assert.strictEqual(parse({ sysroot: "" }).sysroot, undefined);
    assert.strictEqual(parse({ sysroot: 42 }).sysroot, undefined);
    assert.strictEqual(parse({}).sysroot, undefined);
  });

  test("sourceFileMap keeps its order and expands ~ in the targets only", () => {
    const { sourceFileMap } = parse({
      sourceFileMap: { "/build/a": "~/src/a", "/build/b": "/src/b" },
    });
    assert.deepStrictEqual(Object.keys(sourceFileMap), [
      "/build/a",
      "/build/b",
    ]);
    assert.strictEqual(
      sourceFileMap["/build/a"],
      path.join(os.homedir(), "src", "a"),
    );
    assert.strictEqual(sourceFileMap["/build/b"], "/src/b");
  });

  test("sourceFileMap entries that aren't strings are dropped", () => {
    assert.deepStrictEqual(
      parse({ sourceFileMap: { "/build/a": 1, "/build/b": "/src/b" } })
        .sourceFileMap,
      { "/build/b": "/src/b" },
    );
  });

  test("a malformed sourceFileMap is ignored rather than fatal", () => {
    assert.deepStrictEqual(
      parse({ sourceFileMap: "nonsense" }).sourceFileMap,
      {},
    );
    assert.deepStrictEqual(parse({ sourceFileMap: null }).sourceFileMap, {});
  });

  test("logging and pretty printers come from the settings, not the configuration", () => {
    const options = parse(
      { logPath: "/ignored", qtPrettyPrinters: true },
      { logPath: "/tmp/dap.log", logLevel: 2, qtPrettyPrinters: false },
    );
    assert.strictEqual(options.logPath, "/tmp/dap.log");
    assert.strictEqual(options.logLevel, 2);
    assert.strictEqual(options.qtPrettyPrinters, false);
  });
});
