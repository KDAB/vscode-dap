# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import qpoint


def qline_summary(valobj, internal_dict):
    pt1 = valobj.GetChildMemberWithName("pt1")
    pt2 = valobj.GetChildMemberWithName("pt2")
    # LLDB renders a summary function's None return as the literal text
    # "None" rather than falling back to the default struct display, so any
    # unrecognised layout below must produce "" instead.
    if not pt1.IsValid() or not pt2.IsValid():
        return ""
    s1 = qpoint.format_value(pt1)
    s2 = qpoint.format_value(pt2)
    if s1 is None or s2 is None:
        return ""
    # same output as QDebug operator<<(QLine): "QLine(" << p1() << ',' << p2() << ')',
    # where p1()/p2() are QPoint, so their own operator<< nests inside.
    return "QLine(%s,%s)" % (s1, s2)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qline.qline_summary -x "^QLine$"' % category
    )
