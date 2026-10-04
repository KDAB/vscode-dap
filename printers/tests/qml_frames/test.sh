#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Builds main.cpp, debugs it over DAP with the given debugger's
# kdap_qml_frames.py loaded, and diffs the reported call stack against
# expected.txt - the same file for both debuggers, since showing QML frames is
# a promise the extension makes whichever one is behind it. Needs cmake, a
# compiler, and a Qt 6 with QtQml's debug info - the frames are read from
# qtdeclarative's structures, so without it they stay interpreter frames and
# the diff says so.
#
#   gdb       debug with gdb (needs 16.1+)
#   lldb      debug with lldb-dap (needs LLDB 23+, for its frame providers)
#   --keep    keep build/output artifacts on success (they're always kept on failure)
#
# Env:
#   GDB       gdb binary to use (default: gdb)
#   LLDB_DAP  lldb-dap binary to use (default: lldb-dap)

KEEP=0
DEBUGGER=""
for arg in "$@"; do
    case "$arg" in
        --keep) KEEP=1 ;;
        gdb|lldb) DEBUGGER="$arg" ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

case "$DEBUGGER" in
    gdb) KIND=gdb; BINARY="${GDB:-gdb}" ;;
    lldb) KIND=lldb-dap; BINARY="${LLDB_DAP:-lldb-dap}" ;;
    *) echo "Usage: $0 gdb|lldb [--keep]" >&2; exit 1 ;;
esac

OUTPUT="output-$DEBUGGER.txt"

echo "Building fixture..."
./build.sh

echo "Running $BINARY..."
python3 ./stack_probe.py "$KIND" "$BINARY" ./build/main "$(realpath ../..)" > "$OUTPUT"

echo "Comparing output..."
if diff -u expected.txt "$OUTPUT"; then
    echo "PASS"
else
    echo "FAIL: DAP call stack differs; see $SCRIPT_DIR/$OUTPUT" >&2
    exit 1
fi

if [ "$KEEP" = "0" ]; then
    rm -rf build "$OUTPUT"
fi
