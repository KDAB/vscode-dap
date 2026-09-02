#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Builds main.cpp, runs it under lldb with the kdab-qt pretty printers loaded,
# and diffs the printed locals against expected.txt.
#
#   --keep    keep build/output artifacts on success (they're always kept on failure)
#
# Env:
#   LLDB      lldb binary to use (default: lldb)

KEEP=0
for arg in "$@"; do
    case "$arg" in
        --keep) KEEP=1 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

LLDB="${LLDB:-lldb}"

echo "Building fixture..."
./build.sh

echo "Running lldb..."
# --no-lldbinit: a developer's ~/.lldbinit must not perturb this output.
"$LLDB" --batch --no-lldbinit \
    -o "settings set use-color false" \
    -o "command script import $(realpath ..)" \
    -o "breakpoint set --name stopHere" \
    -o "run" \
    -o "frame select 1" \
    -o "script print('>>>')" \
    -o "frame variable" \
    -o "script print('<<<')" \
    ./build/main > lldb-output.txt 2>&1

grep -q "stop reason = breakpoint" lldb-output.txt || {
    echo "FAIL: breakpoint never hit; see $SCRIPT_DIR/lldb-output.txt" >&2
    exit 1
}

# --batch echoes each command back as "(lldb) <command>"; strip those and the
# markers, leaving just the "frame variable" output. Also strip lldb's own DWARF-verifier
# warnings ("error: main 0x...: DW_TAG_member ... extends beyond the bounds of 0x..."): gcc's
# debug info for some QHashPrivate::Span<Node>::Entry instantiations trips lldb's checker even
# though the layout is read correctly, so these are noise, not a printer failure.
#
# The "(Type)" each line opens with is lldb echoing the variable's declared type
# out of the debug info, not anything a printer produced, and compilers disagree
# on how they spell it: gcc collapses the QVector alias to a bare "QVector"
# where clang keeps "QVector<int>" (see the comment at the top of ../qvector.py,
# which is why the printers' own summaries agree across compilers even here).
# Comparing the base name and dropping the template arguments takes that
# disagreement out of the golden output; the full template spelling stays
# asserted, since every container printer names it in the summary itself.
sed -n '/^>>>$/,/^<<<$/p' lldb-output.txt \
    | grep -v -e '^>>>$' -e '^<<<$' -e '^(lldb) ' -e '^error: main .*: DW_TAG_member ' \
    | sed -E 's/^\(([^<>()]+)<.*>\) /(\1) /' > output.txt || :

echo "Comparing output..."
if diff -u expected.txt output.txt; then
    echo "PASS"
else
    echo "FAIL: printer output differs; see $SCRIPT_DIR/output.txt" >&2
    exit 1
fi

if [ "$KEEP" = "0" ]; then
    rm -rf build lldb-output.txt output.txt
fi
