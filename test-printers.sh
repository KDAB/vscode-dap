#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Runs the standalone test suites under printers/. These are independent of the
# extension: no node, no VS Code, just a debugger, g++ and (for the lldb Qt
# printers) Qt. Further suites get appended here as they're added.
#
#   --lldb    the lldb suites only
#   --gdb     the gdb suites only
#
# With neither, every suite runs. Any other argument is passed on to the suites
# themselves, e.g. --keep.

RUN_LLDB=0
RUN_GDB=0
FORWARD=()

for arg in "$@"; do
    case "$arg" in
        --lldb) RUN_LLDB=1 ;;
        --gdb) RUN_GDB=1 ;;
        *) FORWARD+=("$arg") ;;
    esac
done

if [ "$RUN_LLDB" = "0" ] && [ "$RUN_GDB" = "0" ]; then
    RUN_LLDB=1
    RUN_GDB=1
fi

if [ "$RUN_LLDB" = "1" ]; then
    echo "printers/lldb/qt..."
    ./printers/lldb/qt/tests/test.sh "${FORWARD[@]}"
fi

if [ "$RUN_GDB" = "1" ]; then
    echo "printers/gdb..."
    ./printers/gdb/tests/test.sh "${FORWARD[@]}"
fi
