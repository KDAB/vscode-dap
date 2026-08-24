# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def qrect_summary(valobj, internal_dict):
    x1v = valobj.GetChildMemberWithName("x1")
    y1v = valobj.GetChildMemberWithName("y1")
    x2v = valobj.GetChildMemberWithName("x2")
    y2v = valobj.GetChildMemberWithName("y2")
    if not x1v.IsValid() or not y1v.IsValid() or not x2v.IsValid() or not y2v.IsValid():
        # LLDB renders a summary function's None return as the literal text
        # "None" rather than falling back to the default struct display.
        return ""
    x1 = _common.checked_int(x1v)
    y1 = _common.checked_int(y1v)
    x2 = _common.checked_int(x2v)
    y2 = _common.checked_int(y2v)
    # same output as QDebug operator<<(QRect): x1,y1 and x2,y2 are corners,
    # width/height are computed from them.
    return "QRect(%d,%d %dx%d)" % (x1, y1, x2 - x1 + 1, y2 - y1 + 1)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qrect.qrect_summary -x "^QRect$"' % category
    )
