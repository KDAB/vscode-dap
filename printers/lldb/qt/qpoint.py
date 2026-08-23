# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT


def _checked_int(value):
    # Since Qt 6.10 the coordinates are QtPrivate::QCheckedIntegers::QCheckedInt<int>,
    # before that plain int.
    inner = value.GetChildMemberWithName("m_i")
    if inner.IsValid():
        value = inner
    return value.GetValueAsSigned()


def qpoint_summary(valobj, internal_dict):
    x = valobj.GetChildMemberWithName("xp")
    y = valobj.GetChildMemberWithName("yp")
    if not x.IsValid() or not y.IsValid():
        return None
    # same output as QDebug operator<<(QPoint)
    return "QPoint(%d,%d)" % (_checked_int(x), _checked_int(y))


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qpoint.qpoint_summary -x "^QPoint$"' % category
    )
