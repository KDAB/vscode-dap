# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QStack<T> is "class QStack : public QList<T>", adding push()/pop()/top() but no data members
# of its own - the exact same situation as QQueue (see qqueue.py), just with the stack's own
# name. Reuses qvector.py's _real_members()/QVectorSyntheticProvider unmodified; only the
# summary text and registration are new.

from . import qvector


def qstack_summary(valobj, internal_dict):
    members = qvector._real_members(valobj)
    if members is None:
        # LLDB renders a summary function's None return as the literal text "None" rather than
        # falling back to the default struct display.
        return ""
    _, size = members
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    if not type_name:
        return ""
    return "%s (size = %d)" % (type_name, size.GetValueAsSigned())


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qstack.qstack_summary -x "^QStack<.*>$"' % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qvector.QVectorSyntheticProvider -x "^QStack<.*>$"'
        % category
    )
