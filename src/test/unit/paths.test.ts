// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as os from "node:os";
import * as path from "path";

import {
  expandConfigPath,
  expandTilde,
  findExecutableInPath,
  isDirectory,
  isExecutable,
  isFile,
  resolveExecutablePath,
} from "../../paths";

suite("paths", () => {
  test("isExecutable accepts an executable file", async () => {
    assert.strictEqual(await isExecutable(process.execPath), true);
  });

  test("isExecutable rejects a directory", async () => {
    // A searchable directory passes access(X_OK), so this only holds because
    // isExecutable also requires a regular file.
    assert.strictEqual(await isExecutable(os.tmpdir()), false);
  });

  test("isExecutable rejects a missing path", async () => {
    assert.strictEqual(await isExecutable("/nonexistent/kdap-test/gdb"), false);
  });

  test("isDirectory accepts a directory and rejects a file", async () => {
    assert.strictEqual(await isDirectory(os.tmpdir()), true);
    assert.strictEqual(await isDirectory(process.execPath), false);
    assert.strictEqual(await isDirectory("/nonexistent/kdap-test"), false);
  });

  test("isFile accepts a file and rejects a directory", async () => {
    assert.strictEqual(await isFile(process.execPath), true);
    assert.strictEqual(await isFile(os.tmpdir()), false);
    assert.strictEqual(await isFile("/nonexistent/kdap-test/core"), false);
  });

  test("expandTilde expands a leading ~", () => {
    assert.strictEqual(
      expandTilde("~/bin/gdb"),
      path.join(os.homedir(), "bin", "gdb"),
    );
    assert.strictEqual(expandTilde("~"), os.homedir());
  });

  test("expandTilde leaves other paths alone", () => {
    assert.strictEqual(expandTilde("/usr/bin/gdb"), "/usr/bin/gdb");
    assert.strictEqual(expandTilde("gdb-multiarch"), "gdb-multiarch");
    // Not a home directory reference, so it must not be touched.
    assert.strictEqual(expandTilde("~other/bin/gdb"), "~other/bin/gdb");
  });

  test("expandConfigPath substitutes every ${workspaceFolder}", () => {
    assert.strictEqual(
      expandConfigPath("${workspaceFolder}/a/${workspaceFolder}/b", "/ws"),
      "/ws/a//ws/b",
    );
  });

  test("expandConfigPath expands ~ as well", () => {
    assert.strictEqual(
      expandConfigPath("~/logs/dap.log", "/ws"),
      path.join(os.homedir(), "logs", "dap.log"),
    );
  });

  test("expandConfigPath drops ${workspaceFolder} without a folder", () => {
    // Nothing sensible to substitute, so the placeholder is removed rather
    // than left in place for the debugger to choke on.
    assert.strictEqual(
      expandConfigPath("${workspaceFolder}/dap.log", undefined),
      "/dap.log",
    );
  });

  test("findExecutableInPath finds a binary that is certainly on PATH", async () => {
    // "env" is mandated by POSIX to live in a PATH directory.
    const found = await findExecutableInPath("env");
    assert.ok(found, "env should be found on PATH");
    assert.strictEqual(path.basename(found), "env");
  });

  test("findExecutableInPath returns undefined for a missing binary", async () => {
    assert.strictEqual(
      await findExecutableInPath("kdap-definitely-not-a-binary"),
      undefined,
    );
  });

  test("resolveExecutablePath resolves a bare name via PATH", async () => {
    const resolved = await resolveExecutablePath("env");
    assert.ok(path.isAbsolute(resolved), `${resolved} should be absolute`);
  });

  test("resolveExecutablePath leaves a path with a separator alone", async () => {
    assert.strictEqual(
      await resolveExecutablePath("/nonexistent/kdap-test/gdb"),
      "/nonexistent/kdap-test/gdb",
    );
  });

  test("resolveExecutablePath returns an unresolvable bare name unchanged", async () => {
    // The caller reports "not a valid executable" against the name the user
    // actually wrote, so it must survive a failed lookup.
    assert.strictEqual(
      await resolveExecutablePath("kdap-definitely-not-a-binary"),
      "kdap-definitely-not-a-binary",
    );
  });
});
