# lldb Python support

Python that this extension's lldb backend loads into lldb-dap, bundled in the `.vsix`.

- `qt/`: Qt pretty printers, which lldb doesn't ship. See [`qt/README.md`](qt/README.md).
- `kdap_qml_frames.py`: shows the QML functions on a call stack in place of the QML interpreter's
  frames.

## `kdap_qml_frames.py`

The lldb counterpart of `printers/gdb/kdap_qml_frames.py`. A C++ method called from QML is reached
through the QML engine's bytecode interpreter, which leaves a `QV4::Moth::VME::interpret` /
`QV4::Moth::VME::exec` pair of frames per QML function call. `QmlFrameProvider` is a scripted frame
provider that replaces each pair with one synthetic frame, named after the QML function and located
at its `.qml` file and line, so VS Code's call stack shows a mixed C++/QML stack and clicking a QML
frame opens the QML.

A frame provider is the only way lldb has to give a frame a file and line of its own - a type
summary or lldb-dap's `customFrameFormat` can rename a frame, but clicking it would still open the
interpreter's C++. Frame providers first appeared in LLDB 22, and LLDB 23 fixed deadlocks in them
that lldb-dap would run into, so `install()` registers nothing on an older LLDB, which then shows
the interpreter frames as before. Apple's lldb numbers its versions differently and isn't checked;
it gets the provider if it has the API.

The provider only applies to a program with QtQml loaded: returning frames unchanged still has
LLDB unwind the whole stack on every stop, which nothing else should pay for. Frame 0 is never
replaced, so wherever the program stopped keeps its real registers and pc.

Unlike gdb's frame filters, which only change what is shown, a provider's frames are the ones
LLDB's stepping sees, and a synthetic frame has no frame address of its own. So stepping out of
a C++ function the interpreter called directly (e.g. `QV4::FunctionObject::call`) finishes the
whole QML function, landing in `VME::exec` rather than back in the interpreter.

It's imported through lldb-dap's `preRunCommands` (see `src/debuggers/lldb/configuration.ts`),
since a frame provider is registered on a target, which doesn't exist yet when `initCommands` run.

The QML function is read from memory, from the `frame` argument the two interpreter frames share,
as in the gdb version, and needs QtQml's debug info; any frame that can't be read is passed through
unchanged. JIT-compiled QML is out of reach here too: run the program with
`QV4_FORCE_INTERPRETER=1`.

Tested by `printers/tests/qml_frames`, see [`printers/tests/README.md`](../tests/README.md).
