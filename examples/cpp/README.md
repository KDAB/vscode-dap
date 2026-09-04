# hello_world

This is a minimal program to test the DAP extension. It's plain C++, with no Qt
involved, so it only needs a compiler and CMake.

# Instructions

1. Open `code.code-workspace` and install all the recommended extensions.
2. Press F7 to build, you'll be prompted to choose a cmake preset.
3. Open main.cpp and set some breakpoints in `testPrinters()`
4. Press F5 to run.
5. It should have hit the break-point.

To use LLDB, open the debug pane (Ctrl+Shift+D) and choose LLDB in the drop-down
