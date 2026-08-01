// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <cstdio>
#include <cstdlib>

int main() {
  const char *value = getenv("MY_ENV");
  printf("MY_ENV = %s\n", value ? value : "(not set)");
  return 0;
}
