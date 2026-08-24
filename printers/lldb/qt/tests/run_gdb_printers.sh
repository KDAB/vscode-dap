#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Reference tool, not part of the test suite: builds the same fixture used by
# test.sh and runs it under gdb with the same KDevelop Qt printers the
# extension's gdb backend downloads (src/debuggers/gdb/prettyPrinters.ts).
# Prints gdb's rendering to stdout so a new type's expected.txt can be written
# to match it exactly, including spacing.
#
#   --refresh    re-download the printers even if already cached
#
# Env:
#   GDB       gdb binary to use (default: gdb)

REFRESH=0
for arg in "$@"; do
    case "$arg" in
        --refresh) REFRESH=1 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

GDB="${GDB:-gdb}"
BASE_URL="https://raw.githubusercontent.com/iamsergio/kdevelop/vscode-gdb-dap/plugins/gdb/printers"
CACHE_DIR="$SCRIPT_DIR/.gdb-printers"

if [ "$REFRESH" = "1" ]; then
    rm -rf "$CACHE_DIR"
fi

if [ ! -f "$CACHE_DIR/qt.py" ]; then
    echo "Downloading reference gdb printers..."
    mkdir -p "$CACHE_DIR/qtcreator_debugger"
    for f in qtcreator_debugger/__init__.py qtcreator_debugger/dumper.py \
             qtcreator_debugger/gdbbridge.py qtcreator_debugger/qttypes.py \
             helper.py qt.py; do
        curl -sSfL -o "$CACHE_DIR/$f" "$BASE_URL/$f"
    done
fi

echo "Building fixture..."
./build.sh

echo "Running gdb..."
DEBUGINFOD_URLS="" "$GDB" -q -nx -batch \
    -iex "set auto-load off" \
    -iex "python import sys; sys.path.insert(0, '$CACHE_DIR'); from qt import register_qt_printers; register_qt_printers(None)" \
    -ex "break stopHere" \
    -ex "run" \
    -ex "up" \
    -ex "info locals" \
    ./build/main
