# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Qt pretty printers for LLDB.

Load with: command script import /path/to/printers/lldb/qt
"""

from . import qbytearray
from . import qchar
from . import qdate
from . import qhash
from . import qlatin1string
from . import qline
from . import qlinef
from . import qmap
from . import qmultihash
from . import qmultimap
from . import qpoint
from . import qpointf
from . import qqueue
from . import qrect
from . import qrectf
from . import qset
from . import qsize
from . import qsizef
from . import qstack
from . import qstring
from . import qstringlist
from . import qstringview
from . import qtime
from . import qutf8stringview
from . import quuid
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
    qqueue,
    qstack,
    qstring,
    qlatin1string,
    qchar,
    qstringlist,
    qstringview,
    qutf8stringview,
    qbytearray,
    quuid,
    qdate,
    qtime,
    qmap,
    qmultimap,
    qhash,
    qmultihash,
    qset,
)


def __lldb_init_module(debugger, internal_dict):
    for module in _MODULES:
        module.register(debugger, CATEGORY)
    debugger.HandleCommand("type category enable " + CATEGORY)
