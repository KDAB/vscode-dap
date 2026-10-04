# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""A minimal, synchronous DAP client for the printer test suites.

Speaks just enough of the protocol to drive gdb's and lldb-dap's DAP servers
through a launch, a stop and a few requests: no VS Code, no node.
"""

import json
import os
import subprocess
import threading


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
