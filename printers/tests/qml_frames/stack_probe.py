#!/usr/bin/env python3

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Dumps the call stack a DAP server reports at stopHere(), as VS Code sees it.

Debugs build/main with either `gdb -i dap` or lldb-dap, with that debugger's
kdap_qml_frames.py loaded the way the extension loads it, and prints the frames
that belong to the fixture - main.cpp's and main.qml's - one per line as

    <name> <file>:<line>

in stack order, followed by the number of QML interpreter frames left on the
stack. Everything else is Qt's own code, which differs between Qt versions and
builds, so it's counted rather than listed. C++ names lose their parameter
list, which lldb includes and gdb doesn't, so that both debuggers are held to
the same expected.txt.

Then it selects a QML frame the way VS Code does when it's clicked - scopes,
variables, and a watch expression - since a QML frame is still a real frame
underneath, whose variables are the interpreter's.

Usage: stack_probe.py gdb|lldb-dap <debugger binary> <program> <printers dir>
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
from dap_client import DapClient  # noqa: E402

FIXTURE_FILES = ("main.cpp", "main.qml")

# The QML frame selected, and a variable of the interpreter frame behind it.
QML_FRAME = "inner"
INTERPRETER_VARIABLE = "frame"


def main():
    if len(sys.argv) != 5 or sys.argv[1] not in ("gdb", "lldb-dap"):
        raise SystemExit(__doc__.strip().splitlines()[-1])
    kind, binary, program, printers = sys.argv[1:]

    # JIT-compiled QML leaves frames neither debugger can unwind through,
    # which would take the interpreter frames under test with them.
    launch_arguments = {
        "program": os.path.realpath(program),
        "env": {"QV4_FORCE_INTERPRETER": "1"},
    }
    if kind == "gdb":
        module_dir = os.path.join(printers, "gdb")
        argv = [
            binary,
            "-q",
            "-nx",
            "-i",
            "dap",
            "-iex",
            "python import sys; sys.path.insert(0, %r); "
            "import kdap_qml_frames; kdap_qml_frames.install()" % module_dir,
        ]
        # gdb's "env" replaces the inferior's environment rather than adding
        # to it, hence the copy.
        launch_arguments["env"] = dict(os.environ, **launch_arguments["env"])
    else:
        argv = [binary]
        launch_arguments["preRunCommands"] = [
            "command script import %s"
            % json.dumps(os.path.join(printers, "lldb", "kdap_qml_frames.py"))
        ]
    client = DapClient(argv)

    client.request(
        "initialize",
        {
            "clientID": "kdap-qml-frames-probe",
            "adapterID": kind,
            "linesStartAt1": True,
            "columnsStartAt1": True,
            "pathFormat": "path",
        },
    )
    # gdb sends "initialized" right after "initialize", lldb-dap only once it
    # has a "launch" to go on; and gdb answers "launch" only once the program
    # is running, which it isn't until "configurationDone". So: launch first,
    # its response left pending.
    launch = client.send("launch", launch_arguments)
    client.wait_event("initialized")
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
        path = (frame.get("source") or {}).get("path", "")
        name = os.path.basename(path)
        if name not in FIXTURE_FILES:
            continue
        # A QML frame is only clickable if its file is a real path.
        missing = "" if os.path.isfile(path) else " (no such file: %s)" % path
        function = frame["name"].split("(")[0]
        print("%s %s:%d%s" % (function, name, frame["line"], missing))
    print("interpreter frames: %d" % interpreter_frames)

    qml_frame = next((f for f in frames if f["name"] == QML_FRAME), None)
    if qml_frame is not None:
        names = set()
        for scope in client.request("scopes", {"frameId": qml_frame["id"]})["scopes"]:
            if scope["name"].lower().startswith("register"):
                continue
            reference = scope["variablesReference"]
            for variable in client.request(
                "variables", {"variablesReference": reference}
            )["variables"]:
                names.add(variable["name"])
        print(
            "%s has variable %s: %s"
            % (QML_FRAME, INTERPRETER_VARIABLE, INTERPRETER_VARIABLE in names)
        )
        result = client.request(
            "evaluate",
            {"expression": "1+1", "context": "watch", "frameId": qml_frame["id"]},
        )
        print("%s evaluates 1+1: %s" % (QML_FRAME, result["result"]))

    client.close()


if __name__ == "__main__":
    main()
