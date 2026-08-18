#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Runs the whole test suite: the unit tests under plain mocha, then the
# integration tests inside a real VS Code instance. The latter need gdb 16.1+
# and gcc on PATH; pass --unit to skip them.

if [ "$1" = "--unit" ]; then
    echo "Compiling..."
    npx tsc -p tsconfig.test.json

    echo "npm run test:unit..."
    npm run test:unit
else
    echo "npm test..."
    npm test
fi
