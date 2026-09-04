// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include "widget.h"

#include <QApplication>
#include <QMap>
#include <QHash>
#include <QString>
#include <QVector>
#include <QRect>
#include <QSize>

#include <iostream>
#include <map>
#include <string>
#include <vector>

// feel free to set breakpoints here to test the printers
void testPrinters()
{
    std::vector<int> numbers = { 1, 2, 3, 4, 5 };
    std::string greeting = "hello from dap";

    std::map<int, int> map = { { 1, 1 } };

    QString qgreeting = QStringLiteral("hello from dap");
    QVector<int> qnumbers = { 1, 2, 3, 4, 5 };
    QMap<QString, int> qmap = { { "one", 1 }, { "two", 2 }, { "three", 3 } };
    QHash<QString, int> qh = { { "one", 1 }, { "two", 2 }, { "three", 3 } };
    QRect rect(10, 20, 100, 200);
    QSize size(640, 480);
    QString qstr = "qstr";

    std::cout << greeting << '\n';
}


int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    Widget w;
    w.show();

    testPrinters();

    return a.exec();
}
