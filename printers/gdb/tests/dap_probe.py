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

import json
import os
import subprocess
import sys
import threading

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
]


class DapClient:
    """Talks DAP to a debug adapter on a pipe, synchronously."""

    def __init__(self, argv):
        self._proc = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None,
            env=dict(os.environ, DEBUGINFOD_URLS=""),
        )
        self._seq = 0
        self._responses = {}
        self._events = []
        self._cond = threading.Condition()
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    def _read_loop(self):
        stream = self._proc.stdout
        while True:
            header = stream.readline()
            if not header:
                break
            header = header.strip()
            if not header.lower().startswith(b"content-length:"):
                continue
            length = int(header.split(b":")[1])
            stream.readline()  # the blank line ending the headers
            message = json.loads(stream.read(length))
            with self._cond:
                if message.get("type") == "response":
                    self._responses[message["request_seq"]] = message
                else:
                    self._events.append(message)
                self._cond.notify_all()

    def send(self, command, arguments=None):
        """Sends a request without waiting for its response. Returns its seq."""
        self._seq += 1
        body = json.dumps(
            {
                "seq": self._seq,
                "type": "request",
                "command": command,
                "arguments": arguments or {},
            }
        ).encode()
        self._proc.stdin.write(b"Content-Length: %d\r\n\r\n" % len(body) + body)
        self._proc.stdin.flush()
        return self._seq

    def wait_response(self, seq, timeout=60):
        with self._cond:
            if not self._cond.wait_for(lambda: seq in self._responses, timeout):
                raise SystemExit("timed out waiting for response %d" % seq)
            response = self._responses.pop(seq)
        if not response.get("success"):
            raise SystemExit(
                "request %d failed: %s" % (seq, response.get("message", "?"))
            )
        return response.get("body", {})

    def request(self, command, arguments=None, timeout=60):
        return self.wait_response(self.send(command, arguments), timeout)

    def wait_event(self, name, timeout=60):
        with self._cond:
            if not self._cond.wait_for(
                lambda: any(e.get("event") == name for e in self._events), timeout
            ):
                raise SystemExit("timed out waiting for event '%s'" % name)
            for index, event in enumerate(self._events):
                if event.get("event") == name:
                    return self._events.pop(index)

    def close(self):
        try:
            self.request("disconnect", {"terminateDebuggee": True}, timeout=10)
        except SystemExit:
            pass
        self._proc.terminate()
        self._proc.wait(timeout=10)


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
