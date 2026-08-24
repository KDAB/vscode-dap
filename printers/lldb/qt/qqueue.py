# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QQueue<T> is "class QQueue : public QList<T>", adding enqueue()/dequeue() but no data members
# of its own - same situation as QStringList (see qstringlist.py), just still generic over T, so
# its own declared name ("QQueue<int>") already carries the template argument like QList's does
# and needs no bare-alias fallback. Reuses qvector.py's _real_members()/QVectorSyntheticProvider
# unmodified; only the summary text and registration are new.

from . import qvector


def qqueue_summary(valobj, internal_dict):
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
        'type summary add -w %s -e -F qt.qqueue.qqueue_summary -x "^QQueue<.*>$"' % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qvector.QVectorSyntheticProvider -x "^QQueue<.*>$"'
        % category
    )
