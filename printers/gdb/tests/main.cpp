// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <map>
#include <string>
#include <unordered_map>

// A value with no printer of its own, so a map entry whose value is expandable
// stays expandable after the children have been re-paired.
struct Point
{
    int x;
    int y;
};

// Printed by the test's own pretty printer (fixture_printer.py) with the "map"
// display hint and [i].key/[i].value child names - the exact shape the KDevelop
// Qt printers use for QHash, including a num_children() that counts the flat
// children. Exercising that path here means the test needs no Qt.
struct Table
{
    int keys[2];
    int values[2];
};

// The runner breaks here and inspects the frame above, so main() can grow new
// values without any line number in test.sh needing an update.
__attribute__((noinline)) void stopHere()
{
}

int main()
{
    std::map<std::string, int> byName = {{"apple", 1}, {"banana", 2}};
    std::map<int, std::string> byNumber = {{1, "one"}, {2, "two"}};
    std::map<std::string, Point> byNameToPoint = {{"corner", {3, 4}}, {"origin", {0, 0}}};
    std::map<int, int> emptyMap;

    // One element only: std::unordered_map's iteration order is
    // implementation-defined, and this test's output must not be.
    std::unordered_map<std::string, int> single = {{"only", 42}};

    Table table = {{7, 8}, {70, 80}};

    stopHere();
    return 0;
}
