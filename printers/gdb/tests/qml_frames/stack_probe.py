#!/usr/bin/env python3

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Dumps the call stack `gdb -i dap` reports at stopHere(), as VS Code sees it.

Prints the frames that belong to the fixture - main.cpp's and main.qml's - one
per line as

    <name> <file>:<line>

in stack order, followed by the number of QML interpreter frames left on the
stack. Everything else is Qt's own code, which differs between Qt versions and
builds, so it's counted rather than listed. stdout is the golden output test.sh
diffs against expected.txt.

Usage: stack_probe.py <gdb> <program> [-iex-command ...]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
from dap_probe import DapClient  # noqa: E402

FIXTURE_FILES = ("main.cpp", "main.qml")


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__.strip().splitlines()[-1])
    gdb_binary, program, iex_commands = sys.argv[1], sys.argv[2], sys.argv[3:]

    argv = [gdb_binary, "-q", "-nx", "-i", "dap"]
    for command in iex_commands:
        argv += ["-iex", command]
    client = DapClient(argv)

    client.request(
        "initialize",
        {
            "clientID": "kdap-qml-frames-probe",
            "adapterID": "gdb",
            "linesStartAt1": True,
            "columnsStartAt1": True,
            "pathFormat": "path",
        },
    )
    client.wait_event("initialized")
    # JIT-compiled QML leaves frames gdb can't unwind through, which would
    # take the interpreter frames under test with them. gdb's "env" replaces
    # the inferior's environment rather than adding to it, hence the copy.
    launch = client.send(
        "launch",
        {
            "program": program,
            "env": dict(os.environ, QV4_FORCE_INTERPRETER="1"),
        },
    )
    client.request("setFunctionBreakpoints", {"breakpoints": [{"name": "stopHere"}]})
    client.request("configurationDone")
    client.wait_response(launch)
    stopped = client.wait_event("stopped")

    # Not the first of "threads": QtQml starts threads of its own.
    frames = client.request(
        "stackTrace", {"threadId": stopped["body"]["threadId"]}
    )["stackFrames"]

    interpreter_frames = 0
    for frame in frames:
        if frame["name"].startswith("QV4::Moth::VME::"):
            interpreter_frames += 1
        path = frame.get("source", {}).get("path", "")
        name = os.path.basename(path)
        if name not in FIXTURE_FILES:
            continue
        # A QML frame is only clickable if its file is a real path.
        missing = "" if os.path.isfile(path) else " (no such file: %s)" % path
        print("%s %s:%d%s" % (frame["name"], name, frame["line"], missing))
    print("interpreter frames: %d" % interpreter_frames)

    client.close()


if __name__ == "__main__":
    main()
