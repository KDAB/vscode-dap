// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Deliberately free of any `vscode` import, so that its tests can run under
// plain mocha instead of needing a VS Code instance.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** A debugger version as [major, minor]. */
export type GdbVersion = readonly [number, number];

/**
 * The lowest gdb version whose DAP support this extension relies on. 16.1 is
 * where gdb defers starting the inferior to "configurationDone"; before that,
 * "launch" ran the program immediately, so breakpoints sent after
 * "initialized" arrived too late and "stopOnEntry" was ignored.
 */
export const MIN_GDB_VERSION: GdbVersion = [16, 1];

/**
 * Parses the version out of the first line of gdb's `--version` output, e.g.
 * "GNU gdb (Ubuntu 15.2-0ubuntu1) 15.2".
 *
 * gdb puts its version in the last field of that line, so that is where this
 * looks. Scanning forward from "GNU gdb" instead would find whatever version
 * the distribution stamped into the parenthesised part, which is not always
 * gdb's own: openSUSE ships "GNU gdb (GDB; openSUSE Leap 15.4) 12.1".
 */
export function parseGdbVersion(
  versionOutput: string,
): [number, number] | undefined {
  const firstLine = versionOutput.split("\n", 1)[0].trim();
  // The word boundary rejects "GNU gdbserver", which is a plausible thing to
  // point a debugger path at and speaks no DAP at all.
  if (!/^GNU gdb\b/.test(firstLine)) {
    return undefined;
  }

  const lastField = firstLine.split(/\s+/).pop() ?? "";
  // Anchored at the start of the field, so a trailing suffix - as in Fedora's
  // "13.2-1.fc38" or a git build's "16.2.90.20250101-git" - doesn't matter.
  const match = /^(\d+)\.(\d+)/.exec(lastField);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2])];
}

export function isGdbVersionSufficient(version: GdbVersion): boolean {
  const [major, minor] = version;
  const [minMajor, minMinor] = MIN_GDB_VERSION;
  return major > minMajor || (major === minMajor && minor >= minMinor);
}

/** Runs `gdb --version` and parses the result. Returns undefined if gdb can't be run or its version can't be parsed. */
export async function getGdbVersion(
  debuggerPath: string,
): Promise<[number, number] | undefined> {
  try {
    const { stdout } = await execFileAsync(debuggerPath, ["--version"]);
    return parseGdbVersion(stdout);
  } catch {
    return undefined;
  }
}
