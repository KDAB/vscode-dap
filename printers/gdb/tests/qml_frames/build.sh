#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Configures and builds main.cpp via CMake, producing build/main. Qt is found
# the same way printers/lldb/qt/tests/build.sh finds it: CMAKE_PREFIX_PATH or
# QT6_DIR in the environment, or the system locations.

cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
