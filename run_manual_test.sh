#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

CPP_BUILD_DIR=test/cpp_test/build-dev/
VSCODE_DATA=test/cpp_test/build-dev/vscode/

code_clean() {
     # Alias for debugging purposes, when needed
    code --user-data-dir "$VSCODE_DATA" --extensions-dir "$VSCODE_DATA" "$@"
}

rm -rf $CPP_BUILD_DIR &> /dev/null

echo "Running build_package.sh..."
./build_package.sh

cmake -S test/cpp_test/ --preset=dev && \
cmake --build $CPP_BUILD_DIR/ && \
code_clean --install-extension gdb-dap-*.vsix \
     --install-extension ms-vscode.cmake-tools && \
code_clean test/cpp_test/vscode.code-workspace --crash-reporter-directory /tmp/ \
     --disable-workspace-trust
