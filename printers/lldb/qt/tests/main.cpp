// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <QPoint>

// The runners break here and inspect the frame above, so main() can grow new
// values without any line number in test.sh needing an update.
__attribute__((noinline)) void stopHere()
{
}

int main()
{
    QPoint p(10, 20);
    QPoint origin;
    QPoint negative(-5, -7);

    stopHere();
    return 0;
}
