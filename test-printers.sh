#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Runs the standalone pretty-printer test suites under printers/. These are
# independent of the extension: no node, no VS Code, just a debugger, g++ and
# Qt. Further suites get appended here as they're added.

echo "printers/lldb/qt..."
./printers/lldb/qt/tests/test.sh "$@"
