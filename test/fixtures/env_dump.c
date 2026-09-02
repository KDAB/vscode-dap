// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Writes this process's own environment, NUL-separated, to the file named by
// argv[1]. Exists so the "env merge" integration test can read a live
// inferior's real environment portably: there's no /proc on macOS, and
// reading it through the debugger's own "evaluate" would introduce a
// debugger-specific side effect (gdb's evaluator emits a spurious DAP
// "continued" event mid-call) into what's meant to be a debugger-agnostic
// assertion.

#include <stdio.h>
#include <string.h>

extern char **environ;

int main(int argc, char **argv) {
    if (argc < 2) {
        return 1;
    }

    FILE *out = fopen(argv[1], "wb");
    if (!out) {
        return 1;
    }

    for (char **entry = environ; *entry; entry++) {
        fwrite(*entry, 1, strlen(*entry) + 1, out);
    }

    fclose(out);
    return 0;
}
