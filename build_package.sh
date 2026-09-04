#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

rm -rf *vsix &> /dev/null

# tsc leaves behind the output of sources that have since been renamed or
# deleted, and vsce packages whatever is in out/, so a locally built .vsix
# would ship dead code that a CI build - a fresh checkout - never sees.
rm -rf out &> /dev/null

echo "npm install..."
npm install

echo "npm run format:check..."
npm run format:check

echo "npm run lint..."
npm run lint

echo "Compiling..."
npm run compile

echo "vsce package..."
vsce package
