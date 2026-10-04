#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Builds main.cpp, debugs it over DAP with kdap_qml_frames.py loaded, and diffs
# the reported call stack against expected.txt. Needs gdb, cmake, a compiler,
# and a Qt 6 with QtQml's debug info - the filter reads qtdeclarative's
# structures, so without it the QML frames stay interpreter frames and the diff
# says so.
#
#   --keep    keep build/output artifacts on success (they're always kept on failure)
#
# Env:
#   GDB       gdb binary to use (default: gdb)

KEEP=0
for arg in "$@"; do
    case "$arg" in
        --keep) KEEP=1 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

GDB="${GDB:-gdb}"

echo "Building fixture..."
./build.sh

echo "Running gdb -i dap..."
# Loaded the same way the extension loads it, with -iex python.
python3 ./stack_probe.py "$GDB" ./build/main \
    "python import sys; sys.path.insert(0, '$(realpath ../..)'); import kdap_qml_frames; kdap_qml_frames.install()" \
    > output.txt

echo "Comparing output..."
if diff -u expected.txt output.txt; then
    echo "PASS"
else
    echo "FAIL: DAP call stack differs; see $SCRIPT_DIR/output.txt" >&2
    exit 1
fi

if [ "$KEEP" = "0" ]; then
    rm -rf build output.txt
fi
