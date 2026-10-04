# Debugger-independent printer tests

Suites that hold every debugger's Python under `printers/` to the same promise, the way
`src/test/integration/debugSuite.ts` does for the extension: one fixture, one expected output, run
once per debugger. `dap_client.py` is the minimal DAP client they (and `printers/gdb/tests`) use.

## `qml_frames`

Tests `printers/gdb/kdap_qml_frames.py` and `printers/lldb/kdap_qml_frames.py`, which show the QML
functions on a call stack in place of the QML interpreter's frames.

```
qml_frames/test.sh gdb    # needs gdb 16.1+
qml_frames/test.sh lldb   # needs an lldb-dap from LLDB 23+: LLDB_DAP, else lldb-dap on PATH
```

Both need cmake and a Qt 6 whose QtQml has debug info. `test.sh` builds `main.cpp`, a QtQml-only
fixture (no display needed), debugs it over real DAP with `stack_probe.py`, stopping in C++ that
`main.qml` reaches twice over - `Component.onCompleted` → `outer()` → `inner()` →
`Backend::compute()`, whose signal's QML handler calls `Backend::report()` - and diffs the frames
from `main.cpp` and `main.qml` against `expected.txt`, followed by a count of the interpreter
frames left, which should be none. Qt's own frames in between differ between Qt versions and
builds, so they aren't listed, and C++ names lose their parameter list, which lldb includes and
gdb doesn't. It then selects a QML frame the way VS Code does when it's clicked - its variables,
and a watch expression - since a QML frame is still a real frame underneath. The probe launches the fixture with `QV4_FORCE_INTERPRETER=1`, since neither
debugger can unwind through JIT-compiled QML.

`./test-printers.sh` runs the gdb half with the gdb suites, and the lldb half with the lldb ones
only when `LLDB_DAP` is set, since few systems' lldb-dap is 23+ yet; the `test-printers` CI workflow installs LLDB 23 from apt.llvm.org for it.
