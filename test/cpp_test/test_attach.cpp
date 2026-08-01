// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <chrono>
#include <cstdio>
#include <thread>
#include <unistd.h>

int main() {
  printf("test_attach pid = %d\n", getpid());
  fflush(stdout);

  int counter = 0;
  while (true) {
    std::this_thread::sleep_for(std::chrono::seconds(1));
    counter++;
    printf("tick %d\n", counter);
    fflush(stdout);
  }
}
