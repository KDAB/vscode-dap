# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QStringList is "class QStringList : public QList<QString>" - a real subclass, not an alias,
# adding string-specific methods (join(), filter(), ...) but no data members of its own, so its
# layout is exactly QList<QString>'s. LLDB's GetChildMemberWithName() already searches base
# classes, so qvector.py's own _real_members()/QVectorSyntheticProvider work here unmodified;
# this module only supplies the summary text and the registration.
#
# The reference gdb printer collapses a QStringList down to a generic "QList<QString>" rather
# than keeping its own name (see qvector.py's own paragraph in the README for the equivalent
# QVector/QList naming question) - this reads its declared name directly off LLDB's own type
# info instead, so a QStringList keeps being called that.

from . import qvector


def qstringlist_summary(valobj, internal_dict):
    members = qvector._real_members(valobj)
    if members is None:
        # LLDB renders a summary function's None return as the literal text "None" rather than
        # falling back to the default struct display.
        return ""
    _, size = members
    return "QStringList (size = %d)" % size.GetValueAsSigned()


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qstringlist.qstringlist_summary -x "^QStringList$"'
        % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qvector.QVectorSyntheticProvider -x "^QStringList$"'
        % category
    )
