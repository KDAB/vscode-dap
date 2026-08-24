# gdb Python support

Python that this extension's gdb backend loads into `gdb -i dap`, with `-iex python import ...`
(see `buildMapHintArgs` in `src/debuggers/gdb/arguments.ts`). Bundled in the `.vsix`, unlike the
Qt pretty printers, which `src/debuggers/gdb/prettyPrinters.ts` downloads at first use.

Not pretty printers: `printers/lldb/qt` holds printers for a debugger that lacks them, whereas
gdb's Qt printers already exist. What's here fixes how gdb's DAP layer *presents* a printer's
output.

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

## Testing

```
tests/test.sh
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
implementation-defined, so more than one element would make the golden output unstable), and
`tests/fixture_printer.py`'s own map-hinted `gdb.ValuePrinter` for a `Table` struct — modelled on
the KDevelop QHash printer, down to the `[i].key` child names and the `num_children()` that counts
flat children, so that path is covered without Qt.

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
