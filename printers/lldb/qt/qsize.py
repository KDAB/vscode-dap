# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def qsize_summary(valobj, internal_dict):
    w = valobj.GetChildMemberWithName("wd")
    h = valobj.GetChildMemberWithName("ht")
    if not w.IsValid() or not h.IsValid():
        # LLDB renders a summary function's None return as the literal text
        # "None" rather than falling back to the default struct display.
        return ""
    # same output as QDebug operator<<(QSize)
    return "QSize(%d, %d)" % (_common.checked_int(w), _common.checked_int(h))


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qsize.qsize_summary -x "^QSize$"' % category
    )
