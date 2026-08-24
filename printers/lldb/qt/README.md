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

- `QPoint`, `QPointF`
- `QSize`, `QSizeF`
- `QRect`, `QRectF`
- `QLine`, `QLineF`
- `QVector`
- `QString`
- `QMap`
- `QHash`

## TODO: missing types

Types the reference gdb printers (`tests/run_gdb_printers.sh`'s downloaded `qt.py` — see its
`pretty_printers_dict` near the end) support that we don't yet:

- Strings/views: `QLatin1String`, `QStringView`, `QUtf8StringView`, `QByteArray`
- Containers: `QList` itself (we only handle it via the `QVector` alias — a variable actually
  declared as `QList<T>` has no printer today), `QStringList`, `QQueue`, `QStack`,
  `QLinkedList`, `QMultiMap`, `QMultiHash`, `QSet`
- Value types: `QChar`, `QUuid`, `QDate`, `QTime`, `QDateTime`, `QTimeZone`, `QUrl`, `QVariant`,
  `QPersistentModelIndex`
- CBOR: `QCborArray`, `QCborMap`, `QCborValue`, `QCborValueRef`/`QCborValueConstRef`,
  `QCborSimpleType`
- JSON: `QJsonArray`, `QJsonObject`, `QJsonDocument`, `QJsonValue`,
  `QJsonValueRef`/`QJsonValueConstRef`

`QPointF`, `QSizeF`, `QRectF`, `QLine`, `QLineF` are already covered above despite having no gdb
printer at all — see "Adding a type" below for how those were pinned down from Qt's own
`QDebug operator<<` instead.

## Adding a type

One type per commit. Adding `<type>` means editing exactly these four files:

1. **`<type>.py`** (new file) — the printer itself, modelled on `qpoint.py`/`qsizef.py`:
   a `<type>_summary(valobj, internal_dict)` function returning the display string, and a
   `register(debugger, category)` that calls `type summary add -w <category> -F
   qt.<type>.<type>_summary -x "^<type>$"`. Summary only, no synthetic children, unless a later
   type specifically needs them.
   - Use `_common.checked_int(value)` for an integer member (Qt 6.10+ wraps these in
     `QtPrivate::QCheckedIntegers::QCheckedInt<int>`, with the real value in a nested `m_i`
     member; `_common.checked_int` handles both that and plain `int`) and `_common.double(value)`
     for a `qreal`/`double` member. `_common.py` isn't a type module itself — don't add it to
     `__init__.py`'s `_MODULES`.
   - If the type is composed of other Qt value types (e.g. `QLine`'s two `QPoint` members), reuse
     the inner type's own `format_value(valobj)` — see `qline.py`/`qlinef.py` reusing
     `qpoint.py`/`qpointf.py` — rather than re-deriving that type's format.
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
  the format of record **when that type has a printer there** (check
  `pretty_printers_dict[...]` near the end of the downloaded `qt.py`). **Spacing is not consistent
  across types** — e.g. `QPoint(%d,%d)` has no space after the comma but `QSize(%d, %d)` does — so
  check each type's own printer rather than assuming a pattern.
- The reference gdb printers don't cover every type (e.g. `QPointF`, `QSizeF`, `QRectF`, `QLine`,
  `QLineF` have no gdb printer at all, only `QPoint`, `QSize`, `QRect` do). For those, the spec is
  Qt's own `QDebug operator<<` for the type (see `qtbase/src/corelib/**/*.cpp` and the shared
  `formatQPoint`/`formatQSize`/`formatQRect` helpers in `qtbase/src/corelib/io/qdebug_p.h`) —
  simplest way to pin it down exactly is to compile and run a one-off `qDebug() << value;` against
  a real Qt build and copy its stdout.

No changes to `tests/build.sh`, `tests/CMakeLists.txt`, `test-printers.sh`, or the
`.github/workflows/test-printers.yml` workflow should ever be needed for a new type.

**A summary function must never `return None`.** LLDB renders that as the literal text `None`
instead of falling back to the default struct display — return `""` for "couldn't format this,
fall back". This applies to every `<type>_summary` function actually registered with `type summary
add`; a shared helper like `qpoint.py`'s `format_value()` may still return `None` internally as
long as its caller converts that to `""` before returning (see `qpoint_summary`).

**Containers (e.g. `QVector`) are a different shape from the value types above** — see
`qvector.py`. They need a `type synthetic add` children provider (a class with `num_children()`,
`get_child_index()`, `get_child_at_index()`, `update()`) in addition to the summary, registered
under the same regex, so the value can be expanded to see its elements. Two things bite here:

- Once a synthetic provider is registered for a type, the `valobj` a plain summary *function*
  receives becomes the synthetic (index-based) view, not the real one — call
  `valobj.GetNonSyntheticValue()` first to reach the real members. The synthetic provider class
  itself does *not* need this; it's always handed the real value.
- `type summary add` hides children by default once a summary is registered; pass `-e` to keep
  them visible (that's what makes `frame variable` show both `QVector<int> (size = 3)` and the
  expanded `[0]`/`[1]`/`[2]` block).

Also, in Qt6 `QVector<T>` is literally `using QVector = QList<T>;` (no distinct ABI type at all),
and compilers disagree on what type name they leave in the debug info for such an alias: gcc
reports the bare typedef name (`QVector`, no template argument), clang reports the canonical name
(`QVector<int>`). `qvector.py`'s regex (`^QVector(<.*>)?$`) matches both; check this if a future
alias-template type (there may be others) behaves unexpectedly on one toolchain but not the other.

**`QMap` and `QHash` are associative containers**, so their synthetic children are named
`[key]` (via `SBValue.Clone("[key]")` on the value) rather than `[index]`, and, unlike `QVector`,
both are genuine class templates — their debug-info type name always carries the template
arguments (`QMap<int, QString>`, never a bare `QMap`), so their regexes (`^QMap<.*>$`,
`^QHash<.*>$`) require them, and the summary can read the element types straight off
`valobj.GetNonSyntheticValue().GetType().GetName()` instead of digging into a member pointer's
pointee type the way `qvector.py` does.

- `qmap.py` doesn't walk `QMap`'s underlying `std::map` red-black tree itself: `QMap<Key, T>` is
  implemented as a `std::map<Key, T>` (see qtbase's `qmap.h`) reached through
  `d.d.<the-shared-pointer's-only-member>`, and LLDB already ships a synthetic children provider
  for `std::map` — `_std_map()`'s `GetNumChildren()`/`GetChildAtIndex()` calls on that member
  transparently use it, giving sorted-by-key iteration for free.
- `qhash.py` has no equivalent to lean on: `QHash<Key, T>`'s `d` is a
  `QHashPrivate::Data<Node>*`, split into `Span`s of 128 buckets each (`SpanConstants` in
  qtbase's `qhash.h`), and there's no built-in LLDB formatter for that layout. `_nodes()` walks
  `d->spans[bucket / 128].offsets[bucket % 128]` for `bucket` in `0..d->numBuckets` itself,
  skipping buckets whose offset is `0xff` (unused), which reproduces `QHash`'s own iteration
  order. That order depends on the hash seed rather than insertion order, so
  `tests/main.cpp` calls `QHashSeed::setDeterministicGlobalSeed()` before populating its
  `QHash` fixture — without it, `expected.txt`'s `[key]` order would vary from run to run.

## Testing

```
tests/test.sh
```

or from the repo root:

```
./test-printers.sh
```
