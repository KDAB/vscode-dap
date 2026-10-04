# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Shows the QML functions on a call stack instead of the interpreter running them.

A C++ method called from QML is reached through the QML engine's bytecode
interpreter, which leaves two C++ frames on the stack per QML function call:

    QV4::Moth::VME::interpret (frame=0x7fffffffa200, engine=..., code=...)
    QV4::Moth::VME::exec (frame=0x7fffffffa200, engine=...)

Both name the interpreter, not the QML function, so a mixed stack says nothing
about which QML code is running. install() registers a frame filter that turns
each such pair into one frame showing the QML function, its .qml file and the
line being executed, and elides the `interpret` frame into it. gdb's DAP layer
builds its stackTrace responses from frame filters (gdb/dap/frames.py), and
leaves elided frames out of them, so VS Code's call stack shows

    inner        main.qml:5
    outer        main.qml:9

where it would otherwise show interpreter frames. gdb's CLI `bt` shows the same
(`bt -no-filters` to see the frames underneath).

The QML function is described by the `frame` argument of VME::exec, a
QV4::CppStackFrame: its v4Function has the name and the compilation unit (whose
file name is the source), and its instructionPointer locates the line in the
function's line table - the same lookup CppStackFrame::function(), source() and
lineNumber() do in qtdeclarative's qv4stackframe.cpp. Everything is read from
memory rather than by calling those: gdb's DAP layer reports an inferior call as
the program continuing and stopping again, which VS Code answers with another
stackTrace request, which would run this filter again, and so on. Reading
qtdeclarative's private structures needs QtQml's debug info, and their layout is
whatever the running Qt's is - handled below for Qt 6.5 and later. Any frame
that can't be read is passed through unchanged, so the worst case is the stack
gdb would have shown anyway.

Frames from JIT-compiled QML are a different matter: the JIT registers nothing
with gdb, so they show as `??` and gdb usually can't unwind past them, which
loses the VME::exec frames below as well. Running the program with
QV4_FORCE_INTERPRETER=1 keeps every QML function in the interpreter.

Diagnostics go to gdb's DAP log (`set debug dap-log-file`, i.e. the extension's
`kdap.logPath`) - never to stdout, which in DAP mode is the protocol stream.
"""

import sys

import gdb
from gdb.FrameDecorator import FrameDecorator

_FILTER_NAME = "kdap-qml-frames"

_EXEC = "QV4::Moth::VME::exec"
_INTERPRET = "QV4::Moth::VME::interpret"

_LINE_TABLE_TYPES = (
    "QV4::CompiledData::CodeOffsetToLineAndStatement",  # Qt 6.5+
    "QV4::CompiledData::CodeOffsetToLine",
)

_FILE_URL_PREFIX = "file://"

# Logged once per failure reason rather than per frame, since a filter that
# can't read one frame typically can't read any.
_logged = set()


def _log(message):
    """Logs to gdb's DAP log file, if this gdb has one to log to."""
    # Importing gdb.dap outside a DAP session starts its machinery up, so only
    # log through it when the session already has.
    startup = sys.modules.get("gdb.dap.startup")
    if startup is None:
        return
    try:
        startup.log("kdap_qml_frames: " + message)
    except Exception:
        pass


def _log_once(message):
    if message not in _logged:
        _logged.add(message)
        _log(message)


def _int(value):
    """VALUE as an int, unwrapping qtdeclarative's quint32_le-style integers."""
    type_ = value.type.strip_typedefs()
    if type_.code == gdb.TYPE_CODE_STRUCT and any(
        field.name == "val" for field in type_.fields()
    ):
        return int(value["val"])
    return int(value)


def _type_has_field(type_, name):
    type_ = type_.strip_typedefs()
    if type_.code not in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
        return False
    for field in type_.fields():
        if field.name == name:
            return True
        if field.is_base_class and _type_has_field(field.type, name):
            return True
    return False


def _has_field(value, name):
    """Whether VALUE has a data member NAME, its base classes' included."""
    return _type_has_field(value.type, name)


def _read_utf16(pointer, size):
    if size <= 0 or pointer == 0:
        return ""
    data = gdb.selected_inferior().read_memory(pointer, size * 2)
    return bytes(data).decode("utf-16-le", errors="replace")


def _qstring(value):
    """The text of VALUE, a Qt 6 QString or its QArrayDataPointer<char16_t>."""
    data = value["d"] if _has_field(value, "d") else value
    return _read_utf16(int(data["ptr"]), int(data["size"]))


def _qstring_private_at(address):
    """The text of the QStringPrivate (Qt 6's QArrayDataPointer) at ADDRESS.

    Heap::StringOrSymbol keeps it in an opaque byte buffer, so it's read by
    layout: { QArrayData *d; char16_t *ptr; qsizetype size; }.
    """
    pointer_type = gdb.lookup_type("void").pointer()
    words = gdb.Value(address).cast(pointer_type.pointer())
    return _read_utf16(int(words[1]), int(words[2].cast(gdb.lookup_type("long"))))


def _heap_string(value):
    """The text of VALUE, a QV4::Heap::String *."""
    string = value.dereference()
    if _has_field(string, "textStorage"):
        return _qstring_private_at(int(string["textStorage"].address))
    return _qstring(string["text"])


def _compilation_unit(function):
    """FUNCTION's QV4::ExecutableCompilationUnit, as a value."""
    unit = function["compilationUnit"]
    if unit.type.strip_typedefs().code == gdb.TYPE_CODE_PTR:
        return unit.dereference()
    # Qt 6.8+: a WriteBarrier::HeapObjectWrapper, which is a single pointer
    # stored as an integer.
    unit_type = gdb.lookup_type("QV4::ExecutableCompilationUnit").pointer()
    return unit.address.cast(unit_type.pointer()).dereference().dereference()


def _source(function):
    unit = _compilation_unit(function)
    if _has_field(unit, "m_compilationUnit"):
        # Qt 6.8+: the compiled data is held, not inherited.
        unit = unit["m_compilationUnit"]["o"].dereference()
    path = _qstring(unit["m_fileName"])
    # A file loaded from disk is named by its URL; anything else (qrc:/...)
    # is left as is, there being no path to give it.
    if path.startswith(_FILE_URL_PREFIX):
        from urllib.parse import unquote

        path = unquote(path[len(_FILE_URL_PREFIX) :])
    return path


def _name(function):
    unit = _compilation_unit(function)
    index = _int(function["compiledFunction"]["nameIndex"])
    return _heap_string(unit["runtimeStrings"][index])


def _line_table_type():
    for name in _LINE_TABLE_TYPES:
        try:
            return gdb.lookup_type(name)
        except gdb.error:
            continue
    raise gdb.error("no QML line table type")


def _line(frame, function):
    """The line FRAME is executing, as CppStackFrame::lineNumber() finds it."""
    compiled = function["compiledFunction"]
    count = _int(compiled["nLineAndStatementNumbers"])
    if count <= 0:
        return None
    # CompiledData::Function::lineAndStatementNumberOffset(): the table
    # follows the locals, which follow the function's header.
    offset = _int(compiled["localsOffset"]) + _int(compiled["nLocals"]) * 4
    table_address = int(compiled.cast(gdb.lookup_type("long"))) + offset
    table = gdb.Value(table_address).cast(_line_table_type().pointer())

    instruction = int(frame["instructionPointer"])
    # The last entry whose code offset is below the instruction pointer.
    # Before the first instruction has run, that's none of them; the first
    # entry is the function's own line then.
    index = 0
    for i in range(count):
        if _int(table[i]["codeOffset"]) < instruction:
            index = i
        else:
            break
    # Lines of debug instructions are stored negated; see
    # CppStackFrame::lineNumber().
    return abs(_int(table[index]["line"]))


class _QmlLocation:
    def __init__(self, name, source, line):
        self.name = name
        self.source = source
        self.line = line


def _qml_location(decorator):
    """Where the QML function behind DECORATOR's VME::exec frame is, or None."""
    try:
        frame = decorator.inferior_frame().read_var("frame")
        if frame.is_optimized_out or int(frame) == 0:
            return None
        function = frame["v4Function"]
        if int(function) == 0:
            return None
        return _QmlLocation(
            _name(function) or "(anonymous)",
            _source(function),
            _line(frame, function),
        )
    except Exception as e:
        # Not a fault: no QtQml debug info, a Qt whose layout isn't known, or
        # a frame caught half set up.
        _log_once("cannot read a QML frame: " + str(e))
        return None


class _QmlFrameDecorator(FrameDecorator):
    """A VME::exec frame, presented as the QML function it runs."""

    def __init__(self, base, location, elided):
        super().__init__(base)
        self._location = location
        self._elided = elided

    def function(self):
        return self._location.name

    def filename(self):
        return self._location.source

    def line(self):
        return self._location.line

    def elided(self):
        return iter(self._elided) if self._elided else None


def _function_name(decorator):
    try:
        return decorator.inferior_frame().name()
    except Exception:
        return None


def _filter(frames):
    pending = None  # an interpret frame, waiting for its exec frame
    for decorator in frames:
        name = _function_name(decorator)
        if name == _INTERPRET:
            if pending is not None:
                yield pending
            pending = decorator
            continue
        if name == _EXEC:
            location = _qml_location(decorator)
            if location is not None:
                yield _QmlFrameDecorator(
                    decorator, location, [pending] if pending is not None else []
                )
                pending = None
                continue
        if pending is not None:
            yield pending
            pending = None
        yield decorator
    if pending is not None:
        yield pending


class _QmlFrameFilter:
    def __init__(self):
        self.name = _FILTER_NAME
        self.priority = 100
        self.enabled = True

    def filter(self, frames):
        return _filter(frames)


def install():
    """Registers the QML frame filter. Safe to call more than once."""
    try:
        gdb.frame_filters[_FILTER_NAME] = _QmlFrameFilter()
    except Exception as e:
        _log("not installed: " + str(e))
