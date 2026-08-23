# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Qt pretty printers for LLDB.

Load with: command script import /path/to/printers/lldb/qt
"""

from . import qpoint

CATEGORY = "kdab-qt"

_MODULES = (qpoint,)


def __lldb_init_module(debugger, internal_dict):
    for module in _MODULES:
        module.register(debugger, CATEGORY)
    debugger.HandleCommand("type category enable " + CATEGORY)
