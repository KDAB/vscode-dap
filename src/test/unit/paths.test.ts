// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as os from "node:os";
import * as path from "path";

import * as fs from "node:fs/promises";

import {
  expandConfigPath,
  expandTilde,
  findExecutableInPath,
  findInDeveloperToolchain,
  findVersionedExecutableInPath,
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

  suite("findVersionedExecutableInPath", () => {
    // Ubuntu's llvm packages install lldb-dap-20 and no lldb-dap at all, so a
    // temporary PATH with the suffixed names is the case that matters.
    let root: string;
    let firstDir: string;
    let secondDir: string;
    let originalPath: string | undefined;

    async function makeExecutable(dir: string, name: string) {
      const filePath = path.join(dir, name);
      await fs.writeFile(filePath, "#!/bin/sh\n", { mode: 0o755 });
      return filePath;
    }

    setup(async () => {
      root = await fs.mkdtemp(path.join(os.tmpdir(), "kdap-paths-"));
      firstDir = path.join(root, "first");
      secondDir = path.join(root, "second");
      await fs.mkdir(firstDir);
      await fs.mkdir(secondDir);
      originalPath = process.env["PATH"];
      // A nonexistent directory in PATH must not stop the search.
      process.env["PATH"] = [
        firstDir,
        path.join(root, "missing"),
        secondDir,
      ].join(path.delimiter);
    });

    teardown(async () => {
      process.env["PATH"] = originalPath;
      await fs.rm(root, { recursive: true, force: true });
    });

    test("finds the plain name", async () => {
      const expected = await makeExecutable(secondDir, "lldb-dap");
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        expected,
      );
    });

    test("finds a versioned name when there is no plain one", async () => {
      const expected = await makeExecutable(secondDir, "lldb-dap-20");
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        expected,
      );
    });

    test("prefers the highest version", async () => {
      await makeExecutable(firstDir, "lldb-dap-9");
      await makeExecutable(firstDir, "lldb-dap-18");
      const expected = await makeExecutable(secondDir, "lldb-dap-20");
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        expected,
      );
    });

    test("prefers the plain name over a higher version", async () => {
      // Whatever the system points the bare name at is what it means by it.
      const expected = await makeExecutable(secondDir, "lldb-dap");
      await makeExecutable(firstDir, "lldb-dap-99");
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        expected,
      );
    });

    test("ignores names that only look versioned", async () => {
      await makeExecutable(firstDir, "lldb-dap-next");
      await makeExecutable(firstDir, "lldb-dap-20-old");
      await makeExecutable(firstDir, "lldb-dapper");
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        undefined,
      );
    });

    test("ignores a match that isn't executable", async () => {
      await fs.writeFile(path.join(firstDir, "lldb-dap-20"), "", {
        mode: 0o644,
      });
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        undefined,
      );
    });

    test("returns undefined when nothing matches", async () => {
      assert.strictEqual(
        await findVersionedExecutableInPath("lldb-dap"),
        undefined,
      );
    });
  });

  suite("findInDeveloperToolchain", () => {
    const onDarwin = process.platform === "darwin";

    test("finds a tool the toolchain is certain to carry", async function () {
      if (!onDarwin) {
        this.skip();
      }
      // clang is what the Command Line Tools exist to install, so a macOS
      // machine that can build the fixtures at all has it.
      const found = await findInDeveloperToolchain("clang");
      assert.ok(found, "clang should be in the developer toolchain");
      assert.ok(path.isAbsolute(found), `${found} should be absolute`);
    });

    test("returns undefined for a tool no toolchain carries", async () => {
      // Holds on every platform, if for two different reasons: there is no
      // xcrun to ask off macOS, and on macOS xcrun fails to find it.
      assert.strictEqual(
        await findInDeveloperToolchain("kdap-definitely-not-a-binary"),
        undefined,
      );
    });

    test("returns undefined where there is no developer toolchain at all", async function () {
      if (onDarwin) {
        this.skip();
      }
      // Not merely "xcrun isn't installed": the platform check means nothing
      // is executed, so a Linux machine that happens to have something named
      // xcrun on PATH still gets undefined.
      assert.strictEqual(await findInDeveloperToolchain("clang"), undefined);
    });

    // The macOS branch is the entire point of this function and is the one
    // thing CI never runs, being Linux-only. These drive it against a stub
    // xcrun so that a regression in it surfaces here rather than on a user's
    // Mac. The stub shadows the real xcrun on PATH, so these behave the same
    // on either platform.
    suite("against a stubbed toolchain", () => {
      let root: string;
      let originalPath: string | undefined;
      const originalPlatform = process.platform;

      function setPlatform(value: string) {
        // configurable, so that teardown can put the real value back.
        Object.defineProperty(process, "platform", {
          value,
          configurable: true,
        });
      }

      setup(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "kdap-xcrun-"));
        // Mirrors the real xcrun: prints just the path on success, and
        // reports a tool it can't find by exit status, not by output.
        await fs.writeFile(
          path.join(root, "xcrun"),
          [
            "#!/bin/sh",
            'case "$2" in',
            // Something certain to be executable, to stand in for a real
            // toolchain binary.
            `  present) echo "${process.execPath}" ;;`,
            // xcrun answers from its own index, which can name a tool that
            // has since been removed.
            '  stale) echo "/nonexistent/kdap-test/stale" ;;',
            "  silent) ;;",
            '  *) echo "xcrun: error: unable to find utility" >&2; exit 72 ;;',
            "esac",
            "",
          ].join("\n"),
          { mode: 0o755 },
        );
        originalPath = process.env["PATH"];
        process.env["PATH"] = [root, originalPath].join(path.delimiter);
        setPlatform("darwin");
      });

      teardown(async () => {
        setPlatform(originalPlatform);
        process.env["PATH"] = originalPath;
        await fs.rm(root, { recursive: true, force: true });
      });

      test("returns what xcrun printed", async () => {
        assert.strictEqual(
          await findInDeveloperToolchain("present"),
          process.execPath,
        );
      });

      test("rejects a path xcrun named but that isn't there any more", async () => {
        assert.strictEqual(await findInDeveloperToolchain("stale"), undefined);
      });

      test("survives xcrun failing to find the tool", async () => {
        assert.strictEqual(
          await findInDeveloperToolchain("missing"),
          undefined,
        );
      });

      test("survives xcrun succeeding but printing nothing", async () => {
        assert.strictEqual(await findInDeveloperToolchain("silent"), undefined);
      });
    });
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
