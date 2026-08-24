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
- `QVector`, `QList`, `QStringList`, `QQueue`, `QStack`
- `QString`
- `QLatin1String`
- `QStringView`
- `QUtf8StringView`
- `QByteArray`
- `QMap`, `QMultiMap`
- `QHash`, `QMultiHash`
- `QSet`
- `QChar`, `QUuid`, `QDate`, `QTime`, `QUrl`

## TODO: missing types

Types the reference gdb printers (`tests/run_gdb_printers.sh`'s downloaded `qt.py` — see its
`pretty_printers_dict` near the end) support that we don't yet:

- Value types: `QDateTime`, `QTimeZone`, `QVariant`, `QPersistentModelIndex`

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
(`QVector<int>`). `qvector.py`'s regex (`^Q(Vector|List)(<.*>)?$`) matches both spellings of the
alias, plus a variable declared directly as `QList<T>` (which, being the real class rather than an
alias, always carries its template argument regardless of compiler - only the bare `QVector`
spelling needs `qvector_summary()`'s element-type fallback). Watch for the same
one-name-or-two-depending-on-the-compiler issue on any future alias-template type.

`qvector_summary()` reads the container's own declared name off `GetNonSyntheticValue().GetType().GetName()`
rather than hardcoding `"QVector<%s>"`, so `QList<int>` prints as `QList<int> (size = N)` and
`QQueue`/`QStack` (see their own paragraphs further down, which reuse this module's functions
rather than duplicating them) get to keep their own names too - only the bare-alias `"QVector"`
case still needs reconstructing from the element pointer's type. The reference gdb printer
actually collapses a `QStringList` down to a generic `QList<QString>` when displaying it (see
`qstringlist.py`'s own paragraph) - this module's approach of preferring the value's actual
declared name over the reference's naming choice is deliberate and applies there too.

**`QStringList` (`qstringlist.py`) is `class QStringList : public QList<QString>`** - a real
subclass adding string-specific methods but no data members of its own, so its layout is exactly
`QList<QString>`'s. LLDB's `GetChildMemberWithName()` already searches base classes for a member
it doesn't find directly, so `qvector.py`'s `_real_members()` and `QVectorSyntheticProvider` work
on a `QStringList` value completely unmodified; `qstringlist.py` only supplies its own summary
text and registers both under `^QStringList$`. The reference gdb printer, as mentioned above,
prints a `QStringList` as a generic `QList<QString>` rather than keeping its own name; this
prints `QStringList (size = N)` instead, on the view that a Qt developer looking at their own
`QStringList` variable in the debugger would rather see the type they actually wrote.

**`QQueue<T>` (`qqueue.py`) is the same situation as `QStringList`, just still generic**: a real
subclass (`class QQueue : public QList<T>`) adding `enqueue()`/`dequeue()` but no data members of
its own, reusing `qvector.py`'s member access and synthetic provider unmodified. Unlike
`QStringList`, its own declared name (`QQueue<int>`) already carries the template argument the
same way `QList`'s does, so `qqueue_summary()` doesn't need a hardcoded fallback string - and,
unlike the `QStringList` case, the reference gdb printer keeps `QQueue`'s own name too
(`QQueue<int> (size = 2)`, not `QList<int>`), so there's no naming disagreement to resolve here.

**`QStack<T>` (`qstack.py`) is the exact same situation as `QQueue`** - `class QStack : public
QList<T>` adding `push()`/`pop()`/`top()` but no data members of its own - so `qstack.py` is
`qqueue.py` with the class name changed.

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
- `qmultimap.py` reuses `_std_map()` outright rather than duplicating it: `QMultiMap<Key, T>` has
  the exact same `QExplicitlySharedDataPointerV2<QMapData<...>>` layout as `QMap<Key, T>`, the
  only difference being that the `m` member it reaches through is a `std::multimap` rather than a
  `std::map` - and LLDB's own synthetic children provider for `std::multimap` exposes the same
  `GetNumChildren()`/`GetChildAtIndex()` interface `std::map`'s does, so no new traversal code is
  needed. A repeated key's values come out most-recently-inserted-first, because that's the order
  `QMultiMap::insert()` itself builds the underlying tree in (each insert lands at the front of
  that key's run) - walking the raw tree in storage order reproduces it for free, same as
  `QHash`'s bucket order does for `QHash` itself.
- `qhash.py` has no equivalent to lean on: `QHash<Key, T>`'s `d` is a
  `QHashPrivate::Data<Node>*`, split into `Span`s of 128 buckets each (`SpanConstants` in
  qtbase's `qhash.h`), and there's no built-in LLDB formatter for that layout. `_nodes()` walks
  `d->spans[bucket / 128].offsets[bucket % 128]` for `bucket` in `0..d->numBuckets` itself,
  skipping buckets whose offset is `0xff` (unused), which reproduces `QHash`'s own iteration
  order. That order depends on the hash seed rather than insertion order, so
  `tests/main.cpp` calls `QHashSeed::setDeterministicGlobalSeed()` before populating its
  `QHash` fixture — without it, `expected.txt`'s `[key]` order would vary from run to run.

**`QMultiHash<Key, T>` (`qmultihash.py`) reuses `qhash.py`'s `_nodes()` outright** for the same
reason `qmultimap.py` reuses `qmap.py`'s `_std_map()`: its `d` is the exact same
`QHashPrivate::Data<Node>*` span/bucket layout, just with `Node = QHashPrivate::MultiNode<Key,
T>` instead of the plain `Node<Key, T>` - a bucket only ever holds one `Node` no matter how many
values its key has accumulated, so bucket-order traversal is unaffected. What's different is that
a `MultiNode`'s `value` isn't `T` itself but a `Chain *` (`QHashPrivate::MultiNodeChain<T>`), a
singly linked list built by `QMultiHash::insertMulti()` always inserting the new value as the
list's new head - so `qmultihash.py`'s own `_entries()` walks each node's chain in addition to
`_nodes()`'s bucket walk, flattening bucket-order-then-chain-order into one list of `(key, value)`
pairs. Chain order comes out most-recently-inserted-first as a consequence, matching
`QMultiHash`'s own documented iteration order (and `QDebug`'s).

**`QSet<T>` (`qset.py`) is literally `typedef QHash<T, QHashDummyValue> Hash; Hash q_hash;`**
(`qset.h`) - a `QHash<T, QHashDummyValue>` wrapped in a member named `q_hash`, with no data
members of its own. Its `Node<T, QHashDummyValue>` specialisation (`qhash.h`) has only a `key`,
no `value` at all (`QHashDummyValue` is an empty type carrying no information), so
`qset.py`'s own `_nodes()` just calls `qhash.py`'s `_nodes()` on the inner `q_hash` member and
returns whatever it finds unmodified - the only new code is displaying each node's key by index
(`[0]`, `[1]`, ...) instead of by `[key]`, since a set has no separate key/value split to show.

**`QChar` (`qchar.py`) has no gdb reference printer either**, so its format was pinned down the
same way `QLatin1String`/`QStringView`'s were: compiling and running `qDebug() << value` against
a real Qt build (see "Adding a type" above). Its only member is `ucs` (a `char16_t`, one UTF-16
code unit), and its `QDebug` operator wraps it in single quotes without escaping the quote or
backslash characters themselves - there's no parsing ambiguity to worry about with only one
character between two fixed delimiters - not even DEL, which prints as a literal raw byte.
Only C0 control characters get a hex escape (lowercase, using as few hex digits as the value
needs - unlike `QByteArray`'s fixed 2-digit form) and non-ASCII code points get a differently
shaped one (lowercase, 4 digits, unlike `QLatin1String`'s uppercase 4-digit one) - see
`qchar.py`'s own comment for the exact two escape forms and their boundaries.

**`QUuid` (`quuid.py`) mirrors the standard RFC 4122 GUID layout**: `data1` (`uint32`), `data2`
(`uint16`), `data3` (`uint16`), and `data4` (`uchar[8]`, the last 8 bytes of the 128-bit value
verbatim). The reference gdb printer's format is `QUuid({xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx})`
(lowercase hex) - note the braces are part of its own `to_string()`, not something LLDB's
`(QUuid)` prefix already supplies, so `quuid_summary()` includes them itself.

**`QDate` (`qdate.py`) stores a single Julian day number in `jd`** (`qint64`) - the same kind of
day count `std::chrono`'s calendar types use, give or take the epoch, so this reuses Howard
Hinnant's well-known `civil_from_days()` algorithm (public domain, unrelated to any GPL Qt
tooling) rather than re-deriving Gregorian calendar math from scratch. Qt's epoch for `jd` is day
2440588 for 1970-01-01, which is `civil_from_days()`'s own day zero, so converting is just
subtracting that constant first - confirmed by checking `jd` for a handful of known dates
(1970-01-01, 0001-01-01, and the fixture's own 2024-03-15) directly under LLDB before trusting
the conversion. An invalid `QDate` stores the minimum `qint64` in `jd` rather than using a
separate validity flag.

The reference gdb printer's own format for a *valid* date is the bare ISO string with no
`QDate(...)` wrapper at all (e.g. `2024-03-15`, matching `Qt::ISODate`) - confirmed against
`tests/run_gdb_printers.sh`'s output, and kept here since it's an unambiguous, deliberate-looking
convention (`QTime`'s reference format, below, uses the same bare style). Its handling of an
*invalid* `QDate` is broken, though: it prints garbage built from the raw `jd` value instead of a
sensible fallback, so `qdate.py` uses real Qt's own `QDebug` text (`QDate(Invalid)`) for that one
case instead - pinned down the same way as `QLatin1String`/`QStringView`'s formats, by compiling
and running `qDebug() << value` against a real Qt build.

**`QTime` (`qtime.py`) stores milliseconds-since-midnight in `mds`** (`int`), so converting to
`HH:mm:ss.zzz` is plain arithmetic - no calendar math needed, unlike `QDate`'s. An invalid
`QTime` stores `-1` there rather than using a separate validity flag. The reference gdb printer
uses the same bare-string convention `QDate`'s does for a valid time (`13:45:30.500`, no
`QTime(...)` wrapper), and, unlike `QDate`'s broken handling of its invalid case, `QTime`'s
reference handling of an invalid value is already sensible (`invalid QTime`, no garbage) - so
that text is kept as-is here too, rather than falling back to real `QDebug`'s own
`QTime(Invalid)` the way `qdate.py` does for `QDate`.

**`QUrl` (`qurl.py`) is a different situation from every other type here**: its only member is
`d` (a `QUrlPrivate *`, null for a default-constructed/invalid `QUrl`), and `QUrlPrivate` itself
is defined *only* inside qtbase's `qurl.cpp` - never in any header. Every other type's layout
comes from a header the debuggee's own translation unit includes, so the debug info LLDB needs
comes from the debuggee regardless of how Qt's shared library itself was built; `QUrlPrivate` has
no such header, so LLDB can only see its members if `libQt6Core`'s *own* debug info describes
them. Confirmed present both in a from-source Qt 6.10.2 build and in Ubuntu's packaged
`qt6-base-dev` (checked directly - installed it, built a throwaway fixture against it, inspected
`*url.d` under LLDB, purged it again), so this isn't the edge case it might sound like for a
typical Linux setup. A sufficiently stripped Qt install would just make every
`GetChildMemberWithName()` in `format_value()` fail and it return `None`, same as any other
"unrecognised layout" case - falling back to the default struct display of the raw `d` pointer,
not anything actively wrong.

The relevant `QUrlPrivate` members are `port` (`int`, `-1` when absent) and five plain `QString`
members - `scheme`, `userName`, `host`, `path`, `query`, `fragment` - read via the new
`_common.qstring_text()` rather than `qstring.py`'s own `format_value()`, since these get spliced
back together into one URL string here rather than shown individually as their own quoted value.
`password` is deliberately never read: both the reference gdb printer and Qt's own `QDebug
operator<<(QUrl)` omit it from their default display (`QUrl::toString()` includes it; the
`QDebug` operator doesn't), so this follows suit rather than leaking it into a debugger view.

This only reassembles the common `scheme://[user@]host[:port]path[?query][#fragment]` shape;
schemes with no authority component (e.g. `mailto:foo@example.com`) aren't handled specially, on
the same "good enough for debugging, not a full URI-spec reimplementation" basis as `qdate.py`
skipping negative/BCE years. The reference gdb printer's own format for a valid URL is the bare
reassembled string (no `QUrl(...)` wrapper, matching `QDate`/`QTime`'s own bare convention) and,
for an invalid one, `<invalid>` - both confirmed against `tests/run_gdb_printers.sh`'s output,
and both kept here since, unlike `QDate`'s invalid case, the reference's `QUrl` handling isn't
broken.

`<empty>` is this printer's own addition, for a reassembly that comes out empty. It can't just
return `""` there: an empty summary makes LLDB drop the summary and expand the struct instead,
showing the raw `d` pointer the printer exists to replace. `QUrl("")` lands here - it allocates a
`d`, so it isn't the `<invalid>` case, even though `QUrl::isValid()` is false for it - and so
does the one *valid* URL that can reassemble to nothing: a `QUrl` carrying only a password, which
is deliberately not read. That second case is why this isn't just reusing `<invalid>`, which
would be an outright false claim about it.

Two more things bite here, both toolchain-dependent rather than bugs:

- Plain `SBValue.Dereference()` on `d` doesn't work: it resolves against the pointee type as the
  debuggee's own translation unit saw it, which - `QUrlPrivate` never being defined in any header
  it could have included - is just an incomplete forward declaration, so `Dereference()` returns
  an invalid value even when `libQt6Core`'s debug info fully describes the type.
  `SBTarget.FindFirstType()` instead searches every loaded module's debug info (including
  `libQt6Core`'s own) for a complete definition, and `CreateValueFromAddress()` builds a
  properly-typed value at `d`'s address from that - the same completion an interactive `expr --
  *url.d` gets from LLDB's own C++ expression evaluator, just reached through the plain `SBValue`
  API `qurl_summary()` has to use instead.
- Under clang (unlike gcc), `QUrl` itself - not just `QUrlPrivate` - comes out as an incomplete
  type in the debuggee's own DWARF (`frame variable` shows `<incomplete type "QUrl">`, with no
  chance for a registered summary to even run), most likely because clang's `-flimit-debug-info`
  defers to whichever translation unit owns `QUrl`'s complete definition rather than duplicating
  it locally. This only matters for a clang-compiled debuggee - `tests/main.cpp` and CI both only
  ever build with gcc - and it degrades the same way missing `QUrlPrivate` info would: no crash,
  just no printer output for that value.

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

**`QByteArray` (`qbytearray.py`) reuses `QUtf8StringView`'s `escape_bytes()` outright** rather
than duplicating it: `QByteArray`'s own `QDebug` operator escapes byte-by-byte the same way, and
its `d` is a `QArrayDataPointer<char>` - the same shape as `QString`'s (`d.ptr`, `d.size`; see
`qstring.py`'s `format_value()`), just holding raw bytes instead of UTF-16 code units.

## Testing

```
tests/test.sh
```

or from the repo root:

```
./test-printers.sh
```
