# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Makes gdb's DAP layer honour the "map" pretty-printer display hint.

A map-hinted printer (gdb's `display_hint() == "map"`) yields a *flat*,
alternating key, value, key, value... sequence of children and leaves it to the
consumer to re-pair them. gdb's CLI does that: `print` on a QHash renders
`{["banana"] = 2, ["apple"] = 1}`. gdb's DAP layer does not - it consults
display_hint() only to pick indexedVariables vs namedVariables for the "array"
hint (gdb/python/lib/gdb/dap/varref.py) and otherwise forwards each child
verbatim, so VS Code's variables view shows a QHash as

    [0].key   = banana
    [0].value = 2
    [1].key   = apple
    [1].value = 1

- one row per half-entry, named after the printer's internal iteration scheme.
Every map-hinted printer is affected, Qt's and libstdc++'s alike.

install() patches the three VariableReference methods that build the children of
a DAP `variables` response so that a map-hinted printer's children are re-paired
into one child per entry, named `[key]`. That is the same shape the extension's
lldb printers produce (printers/lldb/qt), so both backends render associative
containers identically.

Patching gdb's own DAP layer rather than wrapping the printers is deliberate:
printers registered on an *objfile* - which is how libstdc++'s auto-loaded
std::map printer arrives - are consulted before anything in the global
`gdb.pretty_printers` list, so a wrapper installed there is never asked about a
plain std::map. Patching the consumer side fixes every map-hinted printer,
whatever level it was registered at, and leaves CLI printing (which is already
correct) untouched.

Nothing here is public gdb API, so every step is defensive: any surprise leaves
gdb's own behaviour in place rather than breaking the session. Diagnostics go to
gdb's DAP log (`set debug dap-log-file`, i.e. the extension's `kdap.logPath`) -
never to stdout, which in DAP mode is the protocol stream.

gdb 17 renamed VariableReference's "printer" and "child_cache" attributes to
"_printer" and "_child_cache" (upstream commit dd2d4de349f, "gdb/python/dap:
prefix internal attributes with underscore") without a deprecated alias, so a
gdb 16 and a gdb 17+ instance don't have the same attribute under either name.
_printer_of()/_child_cache_get()/_child_cache_set() below read whichever one
the running gdb actually has instead of hard-coding one spelling.
"""

import gdb

# Set on VariableReference once patched, so a second install() is a no-op.
_MARKER = "_kdap_map_hint_installed"

_MAP_HINT = "map"


def _log(message):
    """Logs to gdb's DAP log file, if this gdb has one to log to."""
    try:
        from gdb.dap.startup import log

        log("kdap_map_hint: " + message)
    except Exception:
        pass


def _is_map_printer(printer):
    """Whether PRINTER is a map-hinted pretty printer."""
    display_hint = getattr(printer, "display_hint", None)
    if display_hint is None:
        return False
    try:
        return display_hint() == _MAP_HINT
    except Exception:
        # A printer that throws from display_hint() is gdb's problem, not ours.
        return False


def _printer_of(instance):
    """INSTANCE's pretty printer, under whichever attribute name this gdb uses."""
    return instance._printer if hasattr(instance, "_printer") else instance.printer


def _child_cache_get(instance):
    """INSTANCE's cached paired children, under whichever attribute name this gdb uses."""
    return instance._child_cache if hasattr(instance, "_child_cache") else instance.child_cache


def _child_cache_set(instance, value):
    """Sets INSTANCE's cached paired children, under whichever attribute name this gdb uses."""
    if hasattr(instance, "_child_cache"):
        instance._child_cache = value
    else:
        instance.child_cache = value


def _child_name(key):
    """The DAP variable name for a map entry with key KEY.

    `str()` on the key runs it through gdb's value printing, pretty printers
    included, which is what makes a QString key render as `["banana"]` rather
    than as its raw struct.
    """
    try:
        return "[%s]" % key
    except Exception:
        return None


def _paired_children(printer):
    """PRINTER's alternating children, re-paired into (name, value) entries."""
    children = iter(printer.children())
    result = []
    # zip() over one iterator twice pulls key then value per entry, and drops a
    # trailing unpaired child from a printer that yields an odd number.
    for index, ((_, key), (_, value)) in enumerate(zip(children, children)):
        name = _child_name(key)
        result.append((name if name is not None else "[%d]" % index, value))
    return result


def _flat_child_count(printer):
    """PRINTER's own count of its flat children, or None if it doesn't say.

    Only honoured for gdb.ValuePrinter subclasses, matching the rule gdb itself
    applies in varref.py, and read as a count of children (so twice the number
    of entries) as the pretty-printing API defines it.
    """
    if not isinstance(printer, gdb.ValuePrinter):
        return None
    num_children = getattr(printer, "num_children", None)
    if num_children is None:
        return None
    try:
        return num_children()
    except Exception:
        return None


def install():
    """Patches gdb's DAP variables handling. Safe to call more than once."""
    try:
        _install()
    except Exception as e:
        # A DAP session that renders maps the old way is a great deal better
        # than one that fails to start.
        _log("not installed: " + str(e))


def _install():
    try:
        from gdb.dap import varref
    except ImportError:
        # Not a DAP session (`gdb -i dap` imports gdb.dap; a plain CLI gdb
        # sourcing this file does not), so there is nothing to fix.
        _log("no gdb.dap.varref, nothing to do")
        return

    cls = getattr(varref, "VariableReference", None)
    if cls is None:
        _log("no VariableReference, nothing to patch")
        return

    if getattr(cls, _MARKER, False):
        return

    if _gdb_honours_map_hint(varref):
        _log("this gdb handles the map hint itself, nothing to do")
        return

    for name in ("cache_children", "child_count", "fetch_one_child"):
        if not callable(getattr(cls, name, None)):
            _log("VariableReference has no " + name + "(), not patching")
            return

    orig_cache_children = cls.cache_children
    orig_child_count = cls.child_count
    orig_fetch_one_child = cls.fetch_one_child

    # The originals are decorated with @in_gdb_thread; these replacements are
    # reached only from those same call paths, and each one that matters ends up
    # in an original anyway, so the assertion is not worth re-stating here.

    def cache_children(self):
        printer = _printer_of(self)
        if _child_cache_get(self) is None and _is_map_printer(printer):
            _child_cache_set(self, _paired_children(printer))
        return orig_cache_children(self)

    def child_count(self):
        # -1 is varref.py's "has children, not counted yet"; any other value is
        # either already computed or None for "no children at all".
        printer = _printer_of(self)
        if self.count == -1 and _is_map_printer(printer):
            flat = _flat_child_count(printer)
            # A printer that can't say (Qt's QMap on Qt6 with no std::map
            # printer available returns None) leaves counting to the pairing.
            self.count = flat // 2 if flat is not None else len(self.cache_children())
        return orig_child_count(self)

    def fetch_one_child(self, idx):
        if not _is_map_printer(_printer_of(self)):
            return orig_fetch_one_child(self, idx)
        # Deliberately not the printer's own child(idx): for a map-hinted
        # printer that index addresses a half-entry, not an entry.
        (name, value) = self.cache_children()[idx]
        if not isinstance(value, gdb.Value):
            value = gdb.Value(value)
        return (name, value)

    cls.cache_children = cache_children
    cls.child_count = child_count
    cls.fetch_one_child = fetch_one_child
    setattr(cls, _MARKER, True)
    _log("installed")


def _gdb_honours_map_hint(varref):
    """Whether this gdb's DAP layer looks like it handles the map hint itself.

    Read from varref.py's source, because there is no version to test against:
    the fix could land in any gdb release, and if it has, pairing the children
    here as well would mangle them. A gdb whose source can't be read is assumed
    to be one of today's, which don't handle it.
    """
    import inspect

    try:
        source = inspect.getsource(varref)
    except Exception:
        return False
    # varref.py today mentions "array" as a quoted literal but never "map",
    # outside of prose about name-to-variable maps.
    return '"%s"' % _MAP_HINT in source or "'%s'" % _MAP_HINT in source
