// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import { DebuggerBackend } from "../../debuggers/backend";
import { backends } from "../../debuggers/registry";

/**
 * The debuggers to run the shared suites against, taken straight from the
 * extension's own registry so that adding a debugger there also runs the
 * suites against it. Each suite skips itself when its debugger isn't
 * installed; set KDAP_TEST_DEBUGGERS to a comma-separated list of backend ids
 * to narrow the list down.
 */
export function enabledTestDebuggers(): readonly DebuggerBackend[] {
  const requested = process.env["KDAP_TEST_DEBUGGERS"];
  if (!requested) {
    return backends;
  }

  const ids = requested
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = ids.filter((id) => !backends.some((b) => b.id === id));
  if (unknown.length !== 0) {
    // Failing loudly beats silently running nothing and reporting success.
    throw new Error(
      `Unknown debugger id(s) in KDAP_TEST_DEBUGGERS: ${unknown.join(", ")}`,
    );
  }
  return backends.filter((b) => ids.includes(b.id));
}
