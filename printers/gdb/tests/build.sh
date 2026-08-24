#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Builds main.cpp into build/main. Plain g++ rather than CMake: this fixture
# deliberately depends on nothing but the standard library, so there is nothing
# to find.
#
# Env:
#   CXX       compiler to use (default: g++)

CXX="${CXX:-g++}"

mkdir -p build
"$CXX" -std=c++17 -g -O0 -o build/main main.cpp
