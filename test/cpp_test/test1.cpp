// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <cstdio>
#include <string>
#include <vector>

#include <QMap>
#include <QHash>
#include <QRect>
#include <QSize>
#include <QString>
#include <QVector>

int add(int a, int b) {
  int sum = a + b;
  return sum;
}

int main() {
  std::vector<int> numbers = {1, 2, 3, 4, 5};
  std::string greeting = "hello from gdb-dap";

   //QString qgreeting = QStringLiteral("hello from gdb-dap");
  QVector<int> qnumbers = {1, 2, 3, 4, 5};
  QMap<QString, int> qmap = {{"one", 1}, {"two", 2}, {"three", 3}};
  QHash<QString, int> qh = {{"one", 1}, {"two", 2}, {"three", 3}};
  QRect rect(10, 20, 100, 200);
  QSize size(640, 480);

  int result = add(2, 3);
  printf("result = %d\n", result);
  printf("greeting = %s\n", greeting.c_str());

  return 0;
}
