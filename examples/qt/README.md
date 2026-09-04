# hello_world

This is a minimal program to test the DAP extension and Qt pretty printers.
This example is tailored for Qt and needs Qt to be in PATH.

# Instructions

1. Open `code.code-workspace` and install all the recommended extensions.
2. Press F7 to build, you'll be prompted to choose a cmake preset.
3. Open main.cpp and set some breakpoints in `testPrinters()`
4. Press F5 to run. With GDB, you'll be prompted to download the pretty printers, say yes
5. It should have hit the break-point.

To use LLDB, open the debug pane (Ctrl+Shift+D) and choose LLDB in the drop-down
