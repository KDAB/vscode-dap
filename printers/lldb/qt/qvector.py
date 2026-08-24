# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# In Qt6, QVector<T> is literally "template<typename T> using QVector = QList<T>;"
# (qcontainerfwd.h) - there is no separate QVector type at the ABI level. Its
# QList<T> layout is a single "d" member (a QArrayDataPointer<T>) holding "d"
# (the allocation, possibly null), "ptr" (T*) and "size" (qsizetype).
#
# Compilers disagree on what debug info they leave behind for the alias
# itself: gcc collapses it to a bare "QVector" typedef with no template
# arguments, while clang keeps "QVector<int>" verbatim. Both forms are
# matched below.
#
# This module also registers for QList itself: a variable actually declared as QList<T> (rather
# than through the QVector alias) has the exact same layout and just wasn't matched by the
# regex before. QList is a real class template, not an alias, so its own name always carries the
# template argument regardless of compiler - only QVector's bare-alias spelling needs the
# element-type fallback in qvector_summary() below.


def _real_members(valobj):
    # GetNonSyntheticValue() matters here specifically because this type also
    # has a synthetic children provider registered below: once one is
    # active, the value handed to the *summary* function is the synthetic
    # (index-based) view, whose GetChildMemberWithName("d") would otherwise
    # fail to find the real "d" member.
    real = valobj.GetNonSyntheticValue()
    d = real.GetChildMemberWithName("d")
    if not d.IsValid():
        return None
    ptr = d.GetChildMemberWithName("ptr")
    size = d.GetChildMemberWithName("size")
    if not ptr.IsValid() or not size.IsValid():
        return None
    return ptr, size


def qvector_summary(valobj, internal_dict):
    members = _real_members(valobj)
    if members is None:
        # LLDB renders a summary function's None return as the literal text
        # "None" rather than falling back to the default struct display.
        return ""
    ptr, size = members
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    if not type_name:
        return ""
    if type_name == "QVector":
        # gcc's bare alias typedef carries no template argument of its own to read.
        type_name = "QVector<%s>" % ptr.GetType().GetPointeeType().GetName()
    # matches the reference gdb printer's QVectorPrinter.to_string()
    return "%s (size = %d)" % (type_name, size.GetValueAsSigned())


class QVectorSyntheticProvider:
    def __init__(self, valobj, internal_dict):
        self.valobj = valobj
        self.update()

    def update(self):
        self.ptr = None
        self.size = 0
        self.element_type = None
        d = self.valobj.GetChildMemberWithName("d")
        if not d.IsValid():
            return
        ptr = d.GetChildMemberWithName("ptr")
        size = d.GetChildMemberWithName("size")
        if not ptr.IsValid() or not size.IsValid():
            return
        self.ptr = ptr
        self.size = size.GetValueAsUnsigned()
        self.element_type = ptr.GetType().GetPointeeType()

    def has_children(self):
        return True

    def num_children(self):
        return self.size

    def get_child_index(self, name):
        try:
            return int(name.lstrip("[").rstrip("]"))
        except ValueError:
            return -1

    def get_child_at_index(self, index):
        if self.ptr is None or index < 0 or index >= self.size:
            return None
        address = self.ptr.GetValueAsUnsigned() + index * self.element_type.GetByteSize()
        return self.ptr.CreateValueFromAddress("[%d]" % index, address, self.element_type)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qvector.qvector_summary -x "^Q(Vector|List)(<.*>)?$"'
        % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qvector.QVectorSyntheticProvider -x "^Q(Vector|List)(<.*>)?$"'
        % category
    )
