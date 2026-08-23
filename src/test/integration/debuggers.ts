// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

/** One debugger the shared integration suites can be run against. */
export interface TestDebugger {
  /** Selector used by KDAP_TEST_DEBUGGERS. */
  readonly id: string;
  /** Used in suite names, so failures say which debugger they came from. */
  readonly displayName: string;
  /** The debug type contributed for this debugger. */
  readonly debugType: string;
  /** Candidate binary names, so a suite can skip itself when none is installed. */
  readonly binaryNames: readonly string[];
}

export const GDB_TEST_DEBUGGER: TestDebugger = {
  id: "gdb",
  displayName: "gdb",
  debugType: "kdap",
  binaryNames: ["gdb"],
};

const allTestDebuggers: readonly TestDebugger[] = [GDB_TEST_DEBUGGER];

/**
 * The debuggers to run the shared suites against. Defaults to all of them,
 * each skipping itself when its binary isn't installed; set
 * KDAP_TEST_DEBUGGERS to a comma-separated list of ids to narrow that down.
 */
export function enabledTestDebuggers(): readonly TestDebugger[] {
  const requested = process.env["KDAP_TEST_DEBUGGERS"];
  if (!requested) {
    return allTestDebuggers;
  }

  const ids = requested
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = ids.filter(
    (id) => !allTestDebuggers.some((d) => d.id === id),
  );
  if (unknown.length !== 0) {
    // Failing loudly beats silently running nothing and reporting success.
    throw new Error(
      `Unknown debugger id(s) in KDAP_TEST_DEBUGGERS: ${unknown.join(", ")}`,
    );
  }
  return allTestDebuggers.filter((d) => ids.includes(d.id));
}
