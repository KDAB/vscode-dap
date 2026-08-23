// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import { buildAdapterEnvironment } from "../../adapterEnvironment";
import { SessionOptions } from "../../sessionOptions";

const noOptions: SessionOptions = {
  skipInitFiles: false,
  sysroot: undefined,
  sourceFileMap: {},
  logPath: undefined,
  logLevel: undefined,
  qtPrettyPrinters: false,
  environment: undefined,
};

/** An empty inherited environment, so tests don't depend on this process's own. */
const noHostEnv: Record<string, string | undefined> = {};

suite("buildAdapterEnvironment", () => {
  test("disables debuginfod when nothing has configured it anywhere", () => {
    // Both gdb and lldb-dap link elfutils' debuginfod client, which queries
    // a server for missing debug symbols on the same thread that answers
    // DAP requests; an unreachable server turns that into an indefinite
    // hang indistinguishable from a protocol-level bug.
    assert.deepStrictEqual(
      buildAdapterEnvironment(noOptions, undefined, noHostEnv),
      { DEBUGINFOD_URLS: "" },
    );
  });

  test("kdap.environment can turn debuginfod back on", () => {
    const options = {
      ...noOptions,
      environment: { DEBUGINFOD_URLS: "https://example.invalid" },
    };
    assert.deepStrictEqual(
      buildAdapterEnvironment(options, undefined, noHostEnv),
      { DEBUGINFOD_URLS: "https://example.invalid" },
    );
  });

  test("a value already in the host environment is left alone", () => {
    // e.g. VS Code opened from a shell that already exports DEBUGINFOD_URLS:
    // that's the user's own choice, not the thing this default guards
    // against, so nothing here should override it.
    const hostEnv = { DEBUGINFOD_URLS: "https://example.invalid" };
    assert.deepStrictEqual(
      buildAdapterEnvironment(noOptions, undefined, hostEnv),
      {},
    );
  });

  test("kdap.environment overrides a value from the host environment", () => {
    const options = {
      ...noOptions,
      environment: { DEBUGINFOD_URLS: "https://from-settings.invalid" },
    };
    const hostEnv = { DEBUGINFOD_URLS: "https://from-shell.invalid" };
    assert.deepStrictEqual(
      buildAdapterEnvironment(options, undefined, hostEnv),
      {
        DEBUGINFOD_URLS: "https://from-settings.invalid",
      },
    );
  });

  test("an empty value in the host environment still counts as configured", () => {
    const hostEnv = { DEBUGINFOD_URLS: "" };
    assert.deepStrictEqual(
      buildAdapterEnvironment(noOptions, undefined, hostEnv),
      {},
    );
  });

  test("kdap.environment is otherwise included", () => {
    const options = { ...noOptions, environment: { FOO: "bar" } };
    assert.deepStrictEqual(
      buildAdapterEnvironment(options, undefined, noHostEnv),
      { DEBUGINFOD_URLS: "", FOO: "bar" },
    );
  });

  test("the backend's own env wins over kdap.environment on a shared key", () => {
    const options = { ...noOptions, environment: { FOO: "from-settings" } };
    assert.deepStrictEqual(
      buildAdapterEnvironment(options, { FOO: "from-backend" }, noHostEnv),
      { DEBUGINFOD_URLS: "", FOO: "from-backend" },
    );
  });

  test("the backend can still re-enable debuginfod itself", () => {
    assert.deepStrictEqual(
      buildAdapterEnvironment(
        noOptions,
        { DEBUGINFOD_URLS: "https://x" },
        noHostEnv,
      ),
      { DEBUGINFOD_URLS: "https://x" },
    );
  });

  test("KDAB_DAP_DISABLE_DEBUGINFOD overrides a value already in the host environment", () => {
    // e.g. a CI job's own DEBUGINFOD_URLS="" that gets re-set to something
    // else before the adapter process actually spawns: this stops the host
    // environment's value from being trusted at all.
    const hostEnv = {
      DEBUGINFOD_URLS: "https://example.invalid",
      KDAB_DAP_DISABLE_DEBUGINFOD: "1",
    };
    assert.deepStrictEqual(
      buildAdapterEnvironment(noOptions, undefined, hostEnv),
      { DEBUGINFOD_URLS: "" },
    );
  });

  test("KDAB_DAP_DISABLE_DEBUGINFOD does not override kdap.environment", () => {
    const options = {
      ...noOptions,
      environment: { DEBUGINFOD_URLS: "https://from-settings.invalid" },
    };
    const hostEnv = {
      DEBUGINFOD_URLS: "https://from-shell.invalid",
      KDAB_DAP_DISABLE_DEBUGINFOD: "1",
    };
    assert.deepStrictEqual(
      buildAdapterEnvironment(options, undefined, hostEnv),
      { DEBUGINFOD_URLS: "https://from-settings.invalid" },
    );
  });

  test("defaults to the real process environment when none is given", () => {
    // Exercises the production code path: whatever this test process's own
    // DEBUGINFOD_URLS happens to be doesn't matter, only that omitting the
    // parameter doesn't throw and produces a plain string record.
    const result = buildAdapterEnvironment(noOptions, undefined);
    assert.strictEqual(typeof result, "object");
  });
});
