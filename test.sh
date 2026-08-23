#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Runs the whole test suite: the unit tests under plain mocha, then the
# integration tests inside a real VS Code instance.
#
#   --unit    unit tests only; needs neither a debugger nor gcc
#   --gdb     integration tests against gdb only (needs gdb 16.1+)
#   --lldb    integration tests against lldb-dap only
#
# With neither --gdb nor --lldb, the integration tests run against every
# debugger the extension supports, skipping any that isn't installed. gcc is
# needed either way, to build the fixture they debug.

UNIT_ONLY=0

for arg in "$@"; do
    case "$arg" in
        --unit) UNIT_ONLY=1 ;;
        --gdb) export KDAP_TEST_DEBUGGERS=gdb ;;
        --lldb) export KDAP_TEST_DEBUGGERS=lldb ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

if [ "$UNIT_ONLY" = "1" ]; then
    echo "Compiling..."
    npx tsc -p tsconfig.test.json

    echo "npm run test:unit..."
    npm run test:unit
else
    echo "npm test..."
    npm test
fi
