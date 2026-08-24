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
- `QLatin1String`
- `QStringView`
- `QUtf8StringView`
- `QMap`
- `QHash`

## TODO: missing types

Types the reference gdb printers (`tests/run_gdb_printers.sh`'s downloaded `qt.py` — see its
`pretty_printers_dict` near the end) support that we don't yet:

- Strings/views: `QByteArray`
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

**`QLatin1String` (`qlatin1string.py`) has no gdb reference printer and a different escaping rule
from `QString`'s**, both pinned down the same way as `QPointF`/`QSizeF`/etc: compiling and running
`qDebug() << value` against a real Qt build (see "Adding a type" above). `QLatin1String` is
`using QLatin1String = QLatin1StringView;` (qstringfwd.h; both gcc and clang report the alias
name, not the canonical one, so `qlatin1string.py`'s regex is the plain `^QLatin1String$`), whose
two members are `m_data` (`const char *`) and `m_size` (`qsizetype`). Its `QDebug` operator is
byte-oriented and treats any byte outside printable ASCII, including the upper half of Latin-1,
as needing a 4-digit-uppercase-hex Unicode escape. This is a real difference from
`QString`/`QStringView`'s own `QDebug` operator (see `qstringview.py`), which only escapes C0
control characters and DEL and prints the rest of Unicode as literal text: an accented character
that a `QString` prints verbatim comes out backslash-u-escaped from the equivalent
`QLatin1String` bytes. (`qstring.py`'s own escaping helper predates this investigation and
escapes every byte at or above the DEL character the same way `QLatin1String` does, which doesn't
actually match real `QString`/`QDebug` output for non-ASCII text — a pre-existing divergence, out
of scope here since it isn't exercised by `tests/main.cpp`'s ASCII-only `QString` fixtures.)

**`QStringView` (`qstringview.py`) is the escaping rule the `QLatin1String` paragraph above
contrasts against** — a non-owning view over the same UTF-16 data `QString` itself stores
(`m_data`, a `char16_t *`, and `m_size`, in UTF-16 code units), read and decoded the same way
`qstring.py`'s `format_value()` reads `QString`'s own `d.ptr`/`d.size`. Its escaping only covers
C0 control characters and DEL; everything else, including astral characters (surrogate pairs
decode to a single Python character via `str.decode("utf-16-le")`, same as `qstring.py`), prints
as literal text.

**`QUtf8StringView` (`qutf8stringview.py`) is a byte-oriented view, not a text one**: its two
members are `m_data` (`const char *`, raw UTF-8 bytes, not owned) and `m_size` (`qsizetype`, in
bytes), and its `QDebug` operator doesn't decode the UTF-8 before deciding what to escape - it
walks the raw bytes the same way `QByteArray`'s does (`qbytearray.py` reuses `escape_bytes()`
from here rather than duplicating it), escaping anything outside printable ASCII as a 2-digit
hex `\xXX`. That means a multi-byte UTF-8 sequence for a non-ASCII character comes out as a run
of `\xXX` escapes, one per byte, rather than the literal character `QStringView` would print for
the same text.

`QUtf8StringView` is also the one type here where the plain-alias assumption from `qlatin1string.py`
(gcc and clang both report the alias name, no extra digging needed) isn't quite enough: the alias
itself lives inside whichever of `qstringfwd.h`'s `q_has_char8_t`/`q_no_char8_t` namespaces is the
*inline* one for the target's C++ standard (`q_has_char8_t` if compiled as C++20 or later, since
that's what makes `char8_t` a real type; `q_no_char8_t` otherwise) - and LLDB's canonical type
name for a variable includes that inline namespace qualifier even though it's invisible to C++
code and to `frame variable`'s own `(TypeName)` display. `qutf8stringview.py`'s regex
(`^(q_has_char8_t::|q_no_char8_t::)?QUtf8StringView$`) matches either qualified form, or the bare
name, so it doesn't depend on the target's C++ standard version. Confirmed empirically the same
way as `QLatin1String`/`QStringView`'s formats: `tests/main.cpp` builds as C++17
(`CMakeLists.txt`'s `CMAKE_CXX_STANDARD`), which puts `QUtf8StringView`'s canonical name under
`q_no_char8_t::` with both gcc and clang.

## Testing

```
tests/test.sh
```

or from the repo root:

```
./test-printers.sh
```
