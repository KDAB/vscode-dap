#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Builds main.cpp, debugs it over DAP with kdap_map_hint.py loaded, and diffs
# the reported variables against expected.txt. The CLI renders map-hinted
# printers correctly either way, so only a DAP client can tell whether the fixup
# works - dap_probe.py is that client.
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
# -nx is dap_probe.py's own doing; the fixup and the fixture's printer are
# loaded the same way the extension loads the fixup, with -iex python.
python3 ./dap_probe.py "$GDB" ./build/main \
    "python import sys; sys.path.insert(0, '$(realpath ..)'); import kdap_map_hint; kdap_map_hint.install()" \
    "source $SCRIPT_DIR/fixture_printer.py" \
    > output.txt

echo "Comparing output..."
if diff -u expected.txt output.txt; then
    echo "PASS"
else
    echo "FAIL: DAP variables differ; see $SCRIPT_DIR/output.txt" >&2
    exit 1
fi

if [ "$KEEP" = "0" ]; then
    rm -rf build output.txt
fi
