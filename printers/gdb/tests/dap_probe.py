#!/usr/bin/env python3

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Dumps what `gdb -i dap` reports for main.cpp's locals, as VS Code sees them.

A minimal DAP client, because that is the only way to observe what this fixup
changes: the CLI renders map-hinted printers correctly with or without it, so
`gdb -batch -ex "info locals"` would prove nothing. Speaks just enough of the
protocol to reach one `variables` request per local, then prints each variable
as

    <name> = <value> [named=<namedVariables>]
        <child name> = <child value>

with children indented one level per nesting depth. stdout is the golden output
test.sh diffs against expected.txt, so nothing that varies between runs (paths,
addresses, references) may appear in it.

Usage: dap_probe.py <gdb> <program> [-iex-command ...]
"""

import os
import sys

# The DAP client is shared with the debugger-independent suites under
# printers/tests.
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "tests")
)
from dap_client import DapClient  # noqa: E402

MAX_DEPTH = 2

# Locals whose rendering this test is about, in the order they appear in
# main.cpp. Listed explicitly so that a gdb which invents extra locals, or
# reorders them, can't turn into a spurious diff.
WANTED = [
    "byName",
    "byNumber",
    "byNameToPoint",
    "emptyMap",
    "single",
    "table",
    "registry",
]


def dump(client, reference, depth):
    for variable in client.request("variables", {"variablesReference": reference})[
        "variables"
    ]:
        print(
            "%s%s = %s" % ("    " * depth, variable["name"], variable.get("value", ""))
        )
        child_reference = variable.get("variablesReference") or 0
        if child_reference and depth < MAX_DEPTH:
            dump(client, child_reference, depth + 1)


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
            "clientID": "kdap-map-hint-probe",
            "adapterID": "gdb",
            # What VS Code sends, and what decides whether "type" and
            # "memoryReference" appear in a variable.
            "supportsVariableType": True,
            "supportsMemoryReferences": True,
            "linesStartAt1": True,
            "columnsStartAt1": True,
            "pathFormat": "path",
        },
    )
    client.wait_event("initialized")
    # gdb answers "launch" only once the program is running, which it isn't
    # until "configurationDone", so this one response has to be left pending.
    launch = client.send("launch", {"program": program})
    client.request("setFunctionBreakpoints", {"breakpoints": [{"name": "stopHere"}]})
    client.request("configurationDone")
    client.wait_response(launch)
    client.wait_event("stopped")

    threads = client.request("threads")["threads"]
    frames = client.request("stackTrace", {"threadId": threads[0]["id"]})["stackFrames"]
    if len(frames) < 2:
        raise SystemExit("expected to be stopped in stopHere(), called from main()")
    # Frame 0 is stopHere(); the locals under test are main()'s.
    scopes = client.request("scopes", {"frameId": frames[1]["id"]})["scopes"]
    locals_scope = next(s for s in scopes if s["name"].lower().startswith("local"))

    variables = {
        variable["name"]: variable
        for variable in client.request(
            "variables", {"variablesReference": locals_scope["variablesReference"]}
        )["variables"]
    }

    for name in WANTED:
        variable = variables.get(name)
        if variable is None:
            print("%s = <missing>" % name)
            continue
        print(
            "%s = %s [named=%s]"
            % (name, variable.get("value", ""), variable.get("namedVariables"))
        )
        reference = variable.get("variablesReference") or 0
        if reference:
            dump(client, reference, 1)

    client.close()


if __name__ == "__main__":
    main()
