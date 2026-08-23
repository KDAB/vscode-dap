# Qt pretty printers for LLDB

Standalone LLDB pretty printers for Qt types, using LLDB's Python scripting API. Not wired into
the vscode-gdb-dap extension (yet) — this is a self-contained tree with its own tests, usable from
a plain `lldb` on the command line.

## Loading

```
(lldb) command script import /path/to/printers/lldb/qt
```

This registers each supported type's summary provider under the `kdab-qt` type category and
enables that category. To load automatically, add the `command script import` line to
`~/.lldbinit`.

## Supported types

- `QPoint`

## Adding a type

One type per commit. Adding `<type>` means editing exactly these four files:

1. **`<type>.py`** (new file) — the printer itself, modelled on `qpoint.py`:
   a `<type>_summary(valobj, internal_dict)` function returning the display string, and a
   `register(debugger, category)` that calls `type summary add -w <category> -F
   qt.<type>.<type>_summary -x "^<type>$"`. Summary only, no synthetic children, unless a later
   type specifically needs them.
2. **`__init__.py`** — add `from . import <type>` and append it to `_MODULES`.
3. **`tests/main.cpp`** — add one block of values for the new type in `main()`, before the call to
   `stopHere()`. Don't touch `stopHere()` or the breakpoint logic in `tests/test.sh` — the test
   breaks on that marker function and dumps every local with a plain `frame variable`, so new
   values need no runner changes.
4. **`tests/expected.txt`** — append the corresponding lines, in the same order the values were
   declared in `main.cpp`.

Before writing step 4, find the exact string format to match:

- Run `tests/run_gdb_printers.sh` — it builds the same `main.cpp` and runs it under gdb with the
  reference KDevelop Qt printers
  (https://raw.githubusercontent.com/iamsergio/kdevelop/vscode-gdb-dap/plugins/gdb/printers/qt.py),
  the same ones `src/debuggers/gdb/prettyPrinters.ts` downloads for the gdb backend. Its stdout is
  the format of record.
- Or read that file's `qt.py` directly for the `<Type>Printer.to_string()` method. **Spacing is
  not consistent across types** — e.g. `QPoint(%d,%d)` has no space after the comma but
  `QSize(%d, %d)` does — so check each type's own printer rather than assuming a pattern.

No changes to `tests/build.sh`, `tests/CMakeLists.txt`, `test-printers.sh`, or the
`.github/workflows/test-printers.yml` workflow should ever be needed for a new type.

## Testing

```
tests/test.sh
```

or from the repo root:

```
./test-printers.sh
```
