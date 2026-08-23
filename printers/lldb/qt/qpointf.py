# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def format_value(valobj):
    # Reused by qlinef.py: QLineF's own QDebug operator streams its two
    # QPointF members through this same operator<<(QPointF).
    x = valobj.GetChildMemberWithName("xp")
    y = valobj.GetChildMemberWithName("yp")
    if not x.IsValid() or not y.IsValid():
        return None
    # same output as QDebug operator<<(QPointF)
    return "QPointF(%g,%g)" % (_common.double(x), _common.double(y))


def qpointf_summary(valobj, internal_dict):
    return format_value(valobj)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qpointf.qpointf_summary -x "^QPointF$"' % category
    )
