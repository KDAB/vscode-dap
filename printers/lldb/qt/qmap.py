# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QMap<Key, T> is a QExplicitlySharedDataPointerV2<QMapData<std::map<Key, T>>> ("d"), whose
# own "d" is a Qt::totally_ordered_wrapper<QMapData<...> *> wrapping the raw pointer (its only
# member, so GetChildAtIndex(0) reaches it regardless of the wrapper's member name). QMapData
# holds the actual std::map in its "m" member. Rather than re-walking the red-black tree
# ourselves, this delegates to LLDB's own std::map synthetic children (GetNumChildren() /
# GetChildAtIndex() already return that std::map's [i] = {first, second} pairs), which keeps
# QMap's iteration order (sorted by key) for free.

from . import _common


def _std_map(valobj):
    real = valobj.GetNonSyntheticValue()
    outer_d = real.GetChildMemberWithName("d")
    if not outer_d.IsValid():
        return None
    wrapper = outer_d.GetChildMemberWithName("d")
    if not wrapper.IsValid():
        return None
    raw_ptr = wrapper.GetChildAtIndex(0)
    if not raw_ptr.IsValid() or raw_ptr.GetValueAsUnsigned() == 0:
        return None
    m = raw_ptr.Dereference().GetChildMemberWithName("m")
    return m if m.IsValid() else None


def qmap_summary(valobj, internal_dict):
    m = _std_map(valobj)
    size = m.GetNumChildren() if m is not None else 0
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display, so an unrecognised layout must produce ""
    # instead.
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    return "%s (size = %d)" % (type_name, size) if type_name else ""


class QMapSyntheticProvider:
    def __init__(self, valobj, internal_dict):
        self.valobj = valobj
        self.update()

    def update(self):
        # The synthetic provider is always handed the real (non-synthetic) value.
        self.m = _std_map(self.valobj)

    def has_children(self):
        return True

    def num_children(self):
        return self.m.GetNumChildren() if self.m is not None else 0

    def get_child_index(self, name):
        if self.m is None:
            return -1
        for i in range(self.m.GetNumChildren()):
            key = _common.key_text(self.m.GetChildAtIndex(i).GetChildMemberWithName("first"))
            if name == "[%s]" % key:
                return i
        return -1

    def get_child_at_index(self, index):
        if self.m is None or index < 0 or index >= self.m.GetNumChildren():
            return None
        pair = self.m.GetChildAtIndex(index)
        key = _common.key_text(pair.GetChildMemberWithName("first"))
        return pair.GetChildMemberWithName("second").Clone("[%s]" % key)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qmap.qmap_summary -x "^QMap<.*>$"' % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qmap.QMapSyntheticProvider -x "^QMap<.*>$"' % category
    )
