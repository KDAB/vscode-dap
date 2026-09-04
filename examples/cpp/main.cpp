// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <iostream>
#include <map>
#include <memory>
#include <string>
#include <vector>

struct Point
{
    int x = 0;
    int y = 0;
};

// feel free to set breakpoints here to test the printers
void testPrinters()
{
    std::vector<int> numbers = { 1, 2, 3, 4, 5 };
    std::string greeting = "hello from dap";

    std::map<int, std::string> map = { { 1, "one" }, { 2, "two" }, { 3, "three" } };
    std::pair<int, std::string> pair = { 42, "answer" };

    auto pointer = std::make_unique<Point>(Point { 10, 20 });
    Point point = { 30, 40 };

    std::cout << greeting << '\n';
}

int main()
{
    testPrinters();
    return 0;
}
