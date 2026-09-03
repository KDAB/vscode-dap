# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def qsizef_summary(valobj, internal_dict):
    w = valobj.GetChildMemberWithName("wd")
    h = valobj.GetChildMemberWithName("ht")
    if not w.IsValid() or not h.IsValid():
        # LLDB renders a summary function's None return as the literal text
        # "None" rather than falling back to the default struct display.
        return ""
    # Formatted to print exactly what a qDebug() << of the same QSizeF would.
    return "QSizeF(%g, %g)" % (_common.double(w), _common.double(h))


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qsizef.qsizef_summary -x "^QSizeF$"' % category
    )
