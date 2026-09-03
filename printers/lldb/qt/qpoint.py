# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def format_value(valobj):
    # Reused by qline.py: QLine's own QDebug operator streams its two QPoint
    # members through this same operator<<(QPoint).
    x = valobj.GetChildMemberWithName("xp")
    y = valobj.GetChildMemberWithName("yp")
    if not x.IsValid() or not y.IsValid():
        return None
    # Formatted to print exactly what a qDebug() << of the same QPoint would.
    return "QPoint(%d,%d)" % (_common.checked_int(x), _common.checked_int(y))


def qpoint_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text
    # "None" rather than falling back to the default struct display, so an
    # unrecognised layout must produce "" instead.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qpoint.qpoint_summary -x "^QPoint$"' % category
    )
