# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Shows the QML functions on a call stack instead of the interpreter running them.

The lldb counterpart of printers/gdb/kdap_qml_frames.py; see there for the
problem. A C++ method called from QML is reached through the QML engine's
bytecode interpreter, which leaves two C++ frames per QML function call:

    QV4::Moth::VME::interpret(QV4::JSTypesStackFrame*, ...)
    QV4::Moth::VME::exec(QV4::JSTypesStackFrame*, QV4::ExecutionEngine*)

QmlFrameProvider is a scripted frame provider that replaces each such pair with
one synthetic frame, named after the QML function and located at its .qml file
and line. lldb-dap builds its stackTrace responses from the thread's frames, so
that is what VS Code's call stack shows, and clicking the frame opens the QML.

Unlike gdb's frame filters, which only change how a frame is presented, a frame
provider changes the thread's frames themselves, and is the only way lldb has
to give a frame a file and line of its own. They're new: scripted frame
providers first appeared in LLDB 22, and LLDB 23 fixed several deadlocks in
them, the kind lldb-dap - which unwinds from more than one thread - would run
into. install() therefore does nothing on an LLDB older than 23, leaving the
interpreter frames as they are.

The QML function is read from memory, from the `frame` argument the two
interpreter frames share, as in the gdb version: name, file and line, the way
qtdeclarative's CppStackFrame::function(), source() and lineNumber() find them.
That needs QtQml's debug info; any frame that can't be read is passed through
unchanged.

Loaded with `command script import` once the target exists (lldb-dap's
preRunCommands), since a frame provider is registered on a target.
"""

import struct

import lldb

try:
    from lldb.plugins.scripted_frame_provider import ScriptedFrameProvider
    from lldb.plugins.scripted_process import ScriptedFrame
except ImportError:
    # An LLDB without frame providers. install() won't register anything, but
    # the classes below still have to be definable.
    ScriptedFrameProvider = object
    ScriptedFrame = object

_EXEC = "QV4::Moth::VME::exec("
_INTERPRET = "QV4::Moth::VME::interpret("

_FILE_URL_PREFIX = "file://"

# LLDB 22 introduced frame providers; 23 is where lldb-dap stops deadlocking on
# them (llvm-project #187411, #191913).
_MIN_LLDB_MAJOR = 23

# What CodeOffsetToLineAndStatement (Qt 6.5+) and its predecessor
# CodeOffsetToLine both start with: quint32_le codeOffset, qint32_le line.
_LINE_ENTRY_PREFIX = struct.Struct("<Ii")


def _child(value, name):
    """VALUE's member NAME, its base classes' included, or None.

    Through the non-synthetic value: with the Qt printers loaded, a QString's
    children are synthetic ones that don't include its `d`.
    """
    child = value.GetNonSyntheticValue().GetChildMemberWithName(name)
    return child if child.IsValid() else None


def _member(value, name):
    child = _child(value, name)
    if child is None:
        raise ValueError("no member " + name + " in " + value.GetTypeName())
    return child


def _int(value):
    """VALUE as an int, unwrapping qtdeclarative's quint32_le-style integers."""
    raw = _child(value, "val")
    return (raw if raw is not None else value).GetValueAsSigned()


def _read(process, address, size):
    error = lldb.SBError()
    data = process.ReadMemory(address, size, error)
    if error.Fail():
        raise ValueError("cannot read memory at %#x: %s" % (address, error))
    return data


def _read_pointer(process, address):
    error = lldb.SBError()
    pointer = process.ReadPointerFromMemory(address, error)
    if error.Fail():
        raise ValueError("cannot read a pointer at %#x: %s" % (address, error))
    return pointer


def _read_utf16(process, pointer, size):
    if size <= 0 or pointer == 0:
        return ""
    return _read(process, pointer, size * 2).decode("utf-16-le", errors="replace")


def _qstring(process, value):
    """The text of VALUE, a Qt 6 QString."""
    data = _member(value, "d")
    return _read_utf16(
        process,
        _member(data, "ptr").GetValueAsUnsigned(),
        _member(data, "size").GetValueAsSigned(),
    )


def _qstring_private_at(process, address):
    """The text of the QStringPrivate (Qt 6's QArrayDataPointer) at ADDRESS.

    Heap::StringOrSymbol keeps it in an opaque byte buffer, so it's read by
    layout: { QArrayData *d; char16_t *ptr; qsizetype size; }.
    """
    pointer_size = process.GetAddressByteSize()
    pointer = _read_pointer(process, address + pointer_size)
    size = _read_pointer(process, address + 2 * pointer_size)
    return _read_utf16(process, pointer, size)


def _value_at(target, name, address, type_name):
    type_ = target.FindFirstType(type_name)
    if not type_.IsValid():
        raise ValueError("no type " + type_name)
    return target.CreateValueFromAddress(name, lldb.SBAddress(address, target), type_)


def _compilation_unit(target, process, function):
    """FUNCTION's QV4::ExecutableCompilationUnit, as a value."""
    unit = _member(function, "compilationUnit")
    if unit.GetType().IsPointerType():
        return unit.Dereference()
    # Qt 6.8+: a WriteBarrier::HeapObjectWrapper, which is a single pointer
    # stored as an integer.
    address = _read_pointer(process, unit.GetLoadAddress())
    return _value_at(target, "unit", address, "QV4::ExecutableCompilationUnit")


def _source(target, process, function):
    unit = _compilation_unit(target, process, function)
    held = _child(unit, "m_compilationUnit")
    if held is not None:
        # Qt 6.8+: the compiled data is held, not inherited.
        unit = _member(held, "o").Dereference()
    path = _qstring(process, _member(unit, "m_fileName"))
    # A file loaded from disk is named by its URL; anything else (qrc:/...)
    # is left as is, there being no path to give it.
    if path.startswith(_FILE_URL_PREFIX):
        from urllib.parse import unquote

        path = unquote(path[len(_FILE_URL_PREFIX) :])
    return path


def _name(target, process, function):
    unit = _compilation_unit(target, process, function)
    index = _int(_member(_member(function, "compiledFunction"), "nameIndex"))
    strings = _member(unit, "runtimeStrings").GetValueAsUnsigned()
    string = _read_pointer(process, strings + index * process.GetAddressByteSize())
    heap_string = _value_at(target, "name", string, "QV4::Heap::String")
    storage = _child(heap_string, "textStorage")
    if storage is not None:
        return _qstring_private_at(process, storage.GetLoadAddress())
    return _qstring(process, _member(heap_string, "text"))


def _line(process, frame, function):
    """The line FRAME is executing, as CppStackFrame::lineNumber() finds it."""
    compiled = _member(function, "compiledFunction")
    count = _int(_member(compiled, "nLineAndStatementNumbers"))
    if count <= 0:
        return None
    # CompiledData::Function::lineAndStatementNumberOffset(): the table
    # follows the locals, which follow the function's header.
    locals_offset = _int(_member(compiled, "localsOffset"))
    offset = locals_offset + _int(_member(compiled, "nLocals")) * 4
    table_address = compiled.GetValueAsUnsigned() + offset
    entry_type = None
    for name in (
        "QV4::CompiledData::CodeOffsetToLineAndStatement",
        "QV4::CompiledData::CodeOffsetToLine",
    ):
        entry_type = process.GetTarget().FindFirstType(name)
        if entry_type.IsValid():
            break
    if entry_type is None or not entry_type.IsValid():
        raise ValueError("no QML line table type")
    entry_size = entry_type.GetByteSize()
    table = _read(process, table_address, count * entry_size)

    instruction = _member(frame, "instructionPointer").GetValueAsSigned()
    # The last entry whose code offset is below the instruction pointer.
    # Before the first instruction has run, that's none of them; the first
    # entry is the function's own line then.
    line = None
    for i in range(count):
        code_offset, entry_line = _LINE_ENTRY_PREFIX.unpack_from(table, i * entry_size)
        if line is None or code_offset < instruction:
            line = entry_line
        if code_offset >= instruction:
            break
    # Lines of debug instructions are stored negated (see
    # qv4compileddata_p.h's CodeOffsetToLineAndStatement).
    return abs(line)


class _QmlLocation:
    def __init__(self, name, source, line):
        self.name = name
        self.source = source
        self.line = line


def _qml_location(sbframe):
    """Where the QML function run by SBFRAME, an interpreter frame, is, or None."""
    try:
        frame = sbframe.FindVariable("frame")
        if not frame.IsValid() or frame.GetValueAsUnsigned() == 0:
            return None
        function = _member(frame, "v4Function")
        if function.GetValueAsUnsigned() == 0:
            return None
        thread = sbframe.GetThread()
        process = thread.GetProcess()
        target = process.GetTarget()
        return _QmlLocation(
            _name(target, process, function) or "(anonymous)",
            _source(target, process, function),
            _line(process, frame, function),
        )
    except Exception:
        # Not a fault: no QtQml debug info, a Qt whose layout isn't known, or
        # a frame caught half set up.
        return None


def _function_name(sbframe):
    return sbframe.GetFunctionName() or ""


class QmlFrame(ScriptedFrame):
    """A VME::exec frame, presented as the QML function it runs."""

    def __init__(self, thread, index, exec_frame, location):
        super().__init__(thread, lldb.SBStructuredData())
        self._index = index
        self._exec_frame = exec_frame
        self._location = location

    def get_id(self):
        return self._index

    def get_pc(self):
        return self._exec_frame.GetPC()

    def get_function_name(self):
        return self._location.name

    def get_symbol_context(self):
        line_entry = lldb.SBLineEntry()
        line_entry.SetFileSpec(lldb.SBFileSpec(self._location.source, False))
        if self._location.line is not None:
            line_entry.SetLine(self._location.line)
        line_entry.SetColumn(0)
        context = lldb.SBSymbolContext()
        context.SetLineEntry(line_entry)
        return context

    def is_artificial(self):
        return False

    # The interpreter's own variables, as gdb shows for its QML frames. LLDB
    # calls get_variables() without the `filters` argument its template
    # documents, and without the other two hooks every value would be taken
    # for a synthetic one and filtered out of Locals; and an expression
    # evaluated in a frame with no variable list crashes LLDB 23.
    def get_variables(self):
        try:
            return self._exec_frame.GetVariables(True, True, False, True)
        except Exception:
            return lldb.SBValueList()

    def get_value_type_for_variable(self, variable):
        return variable.GetValueType()

    def get_value_for_variable_expression(self, expression, options, error):
        return self._exec_frame.GetValueForVariablePath(expression)

    def get_register_context(self):
        return None


class QmlFrameProvider(ScriptedFrameProvider):
    """Replaces each QML interpreter frame pair with the QML function it runs."""

    @staticmethod
    def applies_to_thread(thread):
        # A provider returning input frames still has LLDB unwind every one of
        # them on each stop, which a program without QML shouldn't pay for.
        # Asked again for each stop until it applies, so QtQml loading later
        # on is noticed.
        target = thread.GetProcess().GetTarget()
        for module in target.module_iter():
            name = module.GetFileSpec().GetFilename() or ""
            if name.startswith("libQt6Qml") or name == "QtQml":
                return True
        return False

    @staticmethod
    def get_description():
        return "QML functions in place of the QML interpreter's frames"

    def __init__(self, input_frames, args):
        super().__init__(input_frames, args)
        # One entry per output frame: an input frame's index, or a QmlFrame.
        self._frames = []
        self._next_input = 0
        self._exhausted = False

    def _input_frame(self, index):
        frame = self.input_frames.GetFrameAtIndex(index)
        return frame if frame.IsValid() else None

    def _qml_frame(self, exec_frame, location):
        """A QmlFrame for the next output index, or None if one can't be made."""
        try:
            return QmlFrame(self.thread, len(self._frames), exec_frame, location)
        except Exception:
            # E.g. ScriptedFrame's register layout not knowing the target's
            # architecture. Raising would end the stack here.
            return None

    def _produce(self):
        """Appends the output frame(s) for the next input frame(s)."""
        index = self._next_input
        frame = self._input_frame(index)
        if frame is None:
            self._exhausted = True
            return
        name = _function_name(frame)
        # Frame 0 is where the thread is stopped, so it stays the real frame,
        # with its real registers and pc: LLDB's stepping works from it.
        if not self._frames:
            name = ""
        if name.startswith(_INTERPRET):
            following = self._input_frame(index + 1)
            if following is not None and _function_name(following).startswith(_EXEC):
                location = _qml_location(following) or _qml_location(frame)
                qml_frame = location and self._qml_frame(following, location)
                if qml_frame:
                    self._frames.append(qml_frame)
                    self._next_input = index + 2
                    return
        elif name.startswith(_EXEC):
            # Running JIT-compiled code, or not yet (or no longer) in interpret.
            location = _qml_location(frame)
            qml_frame = location and self._qml_frame(frame, location)
            if qml_frame:
                self._frames.append(qml_frame)
                self._next_input = index + 1
                return
        self._frames.append(index)
        self._next_input = index + 1

    def get_frame_at_index(self, index):
        while len(self._frames) <= index and not self._exhausted:
            self._produce()
        if index < len(self._frames):
            return self._frames[index]
        return None


def _lldb_major():
    version = lldb.SBDebugger.GetVersionString() or ""
    # "lldb version 23.1.2 (...)"; Apple's reads "lldb-1700.0.9.502", which
    # numbers differently and isn't checked.
    marker = "lldb version "
    if marker not in version:
        return None
    try:
        return int(version.split(marker, 1)[1].split(".", 1)[0])
    except ValueError:
        return None


def install(target):
    """Registers QmlFrameProvider on TARGET, if this LLDB is fit to run it."""
    if not target or not target.IsValid():
        return
    if ScriptedFrameProvider is object or not hasattr(
        target, "RegisterScriptedFrameProvider"
    ):
        return
    major = _lldb_major()
    if major is not None and major < _MIN_LLDB_MAJOR:
        return
    error = lldb.SBError()
    target.RegisterScriptedFrameProvider(
        __name__ + ".QmlFrameProvider", lldb.SBStructuredData(), error
    )


def __lldb_init_module(debugger, internal_dict):
    install(debugger.GetSelectedTarget())
