# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import qpointf


def qlinef_summary(valobj, internal_dict):
    pt1 = valobj.GetChildMemberWithName("pt1")
    pt2 = valobj.GetChildMemberWithName("pt2")
    # LLDB renders a summary function's None return as the literal text
    # "None" rather than falling back to the default struct display, so any
    # unrecognised layout below must produce "" instead.
    if not pt1.IsValid() or not pt2.IsValid():
        return ""
    s1 = qpointf.format_value(pt1)
    s2 = qpointf.format_value(pt2)
    if s1 is None or s2 is None:
        return ""
    # same output as QDebug operator<<(QLineF): "QLineF(" << p1() << ',' << p2() << ')',
    # where p1()/p2() are QPointF, so their own operator<< nests inside.
    return "QLineF(%s,%s)" % (s1, s2)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qlinef.qlinef_summary -x "^QLineF$"' % category
    )
