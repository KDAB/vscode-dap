// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import { DebuggerBackend } from "./backend";
import { GdbBackend } from "./gdb/backend";

/**
 * Every debugger this extension supports. Adding one means adding it here and
 * contributing its debug type in package.json; nothing else enumerates them.
 */
export const backends: readonly DebuggerBackend[] = [new GdbBackend()];

/** The debug types this extension handles. */
export const debugTypes: readonly string[] = backends.map((b) => b.debugType);
