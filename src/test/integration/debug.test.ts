// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import { defineDebugSuite } from "./debugSuite";
import { enabledTestDebuggers } from "./debuggers";

// One VS Code instance, one suite per debugger. See debuggers.ts for how to
// narrow the list down.
for (const target of enabledTestDebuggers()) {
  defineDebugSuite(target);
}
