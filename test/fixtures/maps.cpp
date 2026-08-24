// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// An associative container to inspect from the debugger. std::map rather than a
// Qt one so the fixture needs no Qt, and both debuggers have a formatter for it
// out of the box - the extension's job here is only to make sure what they
// produce reaches the variables view as one entry per element.

#include <map>
#include <string>

int main()
{
    std::map<std::string, int> byName = {{"apple", 1}, {"banana", 2}};

    // The suite breaks on the line below, where byName is fully populated.
    return byName.size() == 2 ? 0 : 1;
}
