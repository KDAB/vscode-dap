# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Qt pretty printers for LLDB.

Load with: command script import /path/to/printers/lldb/qt
"""

from . import qhash
from . import qline
from . import qlinef
from . import qmap
from . import qpoint
from . import qpointf
from . import qrect
from . import qrectf
from . import qsize
from . import qsizef
from . import qstring
from . import qvector

CATEGORY = "kdab-qt"

_MODULES = (
    qpoint,
    qpointf,
    qsize,
    qsizef,
    qrect,
    qrectf,
    qline,
    qlinef,
    qvector,
    qstring,
    qmap,
    qhash,
)


def __lldb_init_module(debugger, internal_dict):
    for module in _MODULES:
        module.register(debugger, CATEGORY)
    debugger.HandleCommand("type category enable " + CATEGORY)
