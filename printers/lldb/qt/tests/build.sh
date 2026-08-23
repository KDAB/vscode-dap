#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Configures and builds main.cpp via CMake, producing build/main. Shared by
# test.sh and run_gdb_printers.sh so the build step exists in one place.
#
# Qt itself isn't pointed at explicitly: CMakeLists.txt's find_package(Qt6)
# discovers it on its own, the same way test/cpp_test/CMakeLists.txt does -
# via CMAKE_PREFIX_PATH/QT6_DIR already in the environment, or the system
# locations that the qt6-base-dev package installs into.

cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
