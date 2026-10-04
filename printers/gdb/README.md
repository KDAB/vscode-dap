# gdb Python support

Python that this extension's gdb backend loads into `gdb -i dap`, with `-iex python import ...`
(see `buildBundledScriptArgs` in `src/debuggers/gdb/arguments.ts`). Bundled in the `.vsix`, unlike
the Qt pretty printers, which `src/debuggers/gdb/prettyPrinters.ts` downloads at first use.

Not pretty printers: `printers/lldb/qt` holds printers for a debugger that lacks them, whereas
gdb's Qt printers already exist. What's here fixes how gdb's DAP layer *presents* things: a
printer's output, and the call stack.

## `kdap_map_hint.py`

Makes gdb's DAP layer honour the `map` pretty-printer display hint.

A map-hinted printer yields a flat, alternating `key, value, key, value, ...` child sequence and
leaves the consumer to re-pair it. gdb's CLI does; gdb's DAP layer doesn't, so VS Code's variables
view shows a `QHash<QString, int>` as four rows named `[0].key`, `[0].value`, `[1].key`,
`[1].value` instead of two rows named `["apple"]` and `["banana"]`. `std::map`, `std::unordered_map`
and every other map-hinted printer are affected identically — it's a gap in gdb, not in the
printers.

`install()` patches the `VariableReference` methods in gdb's own `gdb/python/lib/gdb/dap/varref.py`
that build the children of a `variables` response. The alternative — wrapping the printers via
`gdb.pretty_printers` — can't work for all of them: printers registered on an *objfile*, which is
how libstdc++'s auto-loaded `std::map` printer arrives, are consulted before anything in the global
`gdb.pretty_printers` list, so a wrapper there never sees a plain `std::map`. See the module
docstring for the rest of the reasoning.

None of this is public gdb API, so `install()` fails safe: anything unexpected (no `gdb.dap`, a
`VariableReference` of a different shape, a gdb whose `varref.py` looks like it handles the hint
itself) leaves gdb's own behaviour in place. Diagnostics go to gdb's DAP log — set `kdap.logPath`
in the launch configuration and grep for `kdap_map_hint`.

When gdb honours the hint in its DAP layer itself, this file should go away.

## `kdap_qml_frames.py`

Shows the QML functions on a call stack instead of the QML interpreter frames running them.

A C++ method called from QML is reached through the engine's bytecode interpreter, which leaves a
`QV4::Moth::VME::interpret` / `QV4::Moth::VME::exec` pair of C++ frames per QML function call.
`install()` registers a gdb frame filter that turns each pair into one frame named after the QML
function, with its `.qml` file and current line, eliding the `interpret` frame into it. gdb's DAP
layer builds `stackTrace` from frame filters and leaves elided frames out, so VS Code shows a
mixed C++/QML stack. gdb's CLI `bt` does too (`bt -no-filters` shows what's underneath).

The QML function is read from VME::exec's `frame` argument, a `QV4::CppStackFrame`, by walking
qtdeclarative's private structures in memory: the same lookup `CppStackFrame::function()`,
`source()` and `lineNumber()` do, minus the calls. Calling into the inferior is not an option in a
frame filter, because gdb's DAP layer reports an inferior call as a `continued` plus `stopped`
pair, and VS Code answers a stop with another `stackTrace`. Reading those structures needs QtQml's
debug info, and is written against Qt 6.5+; any frame that can't be read is passed through
unchanged.

JIT-compiled QML is out of reach: the JIT registers nothing with gdb, so its frames show as `??`
and gdb usually can't unwind past them. Run the program with `QV4_FORCE_INTERPRETER=1` to keep
every QML function in the interpreter.

## Testing

```
tests/test.sh             # kdap_map_hint.py
tests/qml_frames/test.sh  # kdap_qml_frames.py
```

or from the repo root:

```
./test-printers.sh
```

`tests/test.sh` needs only gdb and g++ — no Qt, no printer download, no node, no VS Code. It debugs
`tests/main.cpp` over real DAP with `tests/dap_probe.py` (a ~200-line DAP client, because the CLI
renders map-hinted printers correctly with or without the fixup, so only a DAP client can tell
whether it works) and diffs the reported variables against `tests/expected.txt`.

The fixture covers `std::map` with string and integer keys, values that are themselves expandable,
an empty map, a single-element `std::unordered_map` (its iteration order is
implementation-defined, so more than one element would make the golden output unstable), and two
map-hinted `gdb.ValuePrinter`s of its own in `tests/fixture_printer.py`, so both shapes are covered
without Qt and whatever the local libstdc++ does: `Table`, modelled on the KDevelop QHash printer
down to the `[i].key` child names and a `num_children()` counting flat children, and `Registry`,
whose `num_children()` counts entries instead — what libstdc++'s `std::map` and
`std::unordered_map` printers report between gcc `de124ffe1439` and gcc `b80a4347fc63`. The fixup
counts by pairing rather than by halving `num_children()` precisely because the two disagree; a
single-entry `Registry` is what a halved count would report as empty.

`expected.txt` includes each variable's summary string, which for the `std::` types comes from
libstdc++'s own printers (`std::map with 2 elements`), so a libstdc++ that words it differently
shows up as a diff. A gdb that starts pairing map children itself would too: `install()` steps
aside for it, and if its names or counts differ from the fixup's, this suite is where that surfaces
— which is the point.

To see the bug the fixup fixes, run the probe without loading it:

```
cd tests && ./build.sh
python3 dap_probe.py gdb ./build/main "source $PWD/fixture_printer.py"
```

### `tests/qml_frames`

Needs gdb, cmake and a Qt 6 whose QtQml has debug info. It debugs `tests/qml_frames/main.cpp` over
real DAP with `stack_probe.py` (which reuses `dap_probe.py`'s client), stopping in C++ that
`main.qml` reaches twice over - `Component.onCompleted` → `outer()` → `inner()` →
`Backend::compute()`, whose signal's QML handler calls `Backend::report()` - and diffs the frames
from `main.cpp` and `main.qml` against `expected.txt`, followed by a count of the interpreter
frames left, which should be none. Qt's own frames in between differ between Qt versions and
builds, so they aren't listed. The probe launches the fixture with `QV4_FORCE_INTERPRETER=1`.

To see what the filter fixes, run the probe without it:

```
cd tests/qml_frames && ./build.sh
python3 stack_probe.py gdb ./build/main
```
