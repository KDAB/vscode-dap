// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";

import {
  isGdbVersionSufficient,
  MIN_GDB_VERSION,
  parseGdbVersion,
} from "../../../debuggers/gdb/version";

suite("parseGdbVersion", () => {
  const accepted: [string, [number, number]][] = [
    ["GNU gdb (Ubuntu 16.2-8ubuntu1) 16.2", [16, 2]],
    ["GNU gdb (GDB) 16.1", [16, 1]],
    ["GNU gdb 15.2", [15, 2]],
    // The distribution's version in the parenthesised part is not gdb's own.
    ["GNU gdb (GDB; openSUSE Leap 15.4) 12.1", [12, 1]],
    ["GNU gdb (Ubuntu 12.1-0ubuntu1~22.04.2) 12.1", [12, 1]],
    // A trailing suffix on the version field is ignored.
    ["GNU gdb (GDB) Fedora 13.2-1.fc38", [13, 2]],
    ["GNU gdb (GDB) 16.2.90.20250101-git", [16, 2]],
    // Only the first line is version information.
    [
      "GNU gdb (GDB) 16.2\nCopyright (C) 2025 Free Software Foundation",
      [16, 2],
    ],
    ["  GNU gdb (GDB) 16.2  \n", [16, 2]],
  ];

  for (const [output, expected] of accepted) {
    test(`parses ${JSON.stringify(output)}`, () => {
      assert.deepStrictEqual(parseGdbVersion(output), expected);
    });
  }

  const rejected: string[] = [
    "",
    "lldb version 20.1.2",
    // Not gdb, however much it looks like it.
    "GNU gdbserver (GDB) 16.2",
    "GNU gdb",
    "GNU gdb (GDB) unknown",
    // The version must lead the last field, not merely appear in it.
    "GNU gdb (GDB) v16.2",
  ];

  for (const output of rejected) {
    test(`rejects ${JSON.stringify(output)}`, () => {
      assert.strictEqual(parseGdbVersion(output), undefined);
    });
  }
});

suite("isGdbVersionSufficient", () => {
  test("accepts the minimum and anything above it", () => {
    assert.strictEqual(isGdbVersionSufficient(MIN_GDB_VERSION), true);
    assert.strictEqual(isGdbVersionSufficient([16, 2]), true);
    // A higher major wins even with a lower minor.
    assert.strictEqual(isGdbVersionSufficient([17, 0]), true);
  });

  test("rejects anything below the minimum", () => {
    assert.strictEqual(isGdbVersionSufficient([16, 0]), false);
    assert.strictEqual(isGdbVersionSufficient([15, 2]), false);
    assert.strictEqual(isGdbVersionSufficient([9, 9]), false);
  });
});
