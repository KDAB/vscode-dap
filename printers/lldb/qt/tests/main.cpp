// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <QLine>
#include <QLineF>
#include <QPoint>
#include <QRect>
#include <QSize>
#include <QVector>

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

    QPointF pf(1.5, 2.5);
    QPointF pfZero(0, 0);
    QPointF pfNegative(-1.25, -3.75);

    QSize sz(30, 40);
    QSize szZero(0, 0);
    QSize szNegative(-1, -1);

    QSizeF szf(30.5, 40.5);
    QSizeF szfZero(0, 0);

    QRect r(1, 2, 30, 40);
    QRect rZero(0, 0, 0, 0);
    QRect rNegative(-1, -2, 10, 10);

    QRectF rf(1.5, 2.5, 30.5, 40.5);
    QRectF rfZero(0, 0, 0, 0);

    QLine ln(QPoint(1, 2), QPoint(3, 4));
    QLine lnZero(QPoint(0, 0), QPoint(0, 0));

    QLineF lnf(QPointF(1.5, 2.5), QPointF(3.5, 4.5));

    QVector<int> vec = {1, 2, 3};
    QVector<int> vecEmpty;

    stopHere();
    return 0;
}
