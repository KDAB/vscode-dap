// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Dereferences a null pointer to produce a core dump, for exercising the
// "Load Core Dump" launch configuration snippet. Enable core dumps first,
// e.g. `ulimit -c unlimited`.

int main() {
  int *ptr = nullptr;
  return *ptr;
}
