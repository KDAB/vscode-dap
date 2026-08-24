# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QSet<T> is "typedef QHash<T, QHashDummyValue> Hash; Hash q_hash;" (qset.h) - a QHash<T,
# QHashDummyValue> wrapped in a member named "q_hash", with no data members of its own. Its
# QHashPrivate::Node<T, QHashDummyValue> specialisation (qhash.h) has only a "key", no "value" at
# all (QHashDummyValue is empty and carries no information), so qhash.py's own _nodes() - called
# here on the inner q_hash member rather than the QSet value itself - already returns exactly
# what's needed; this module just displays each node's key by index instead of by "[key]",
# since a set has no separate key/value split.

from . import qhash


def _nodes(valobj):
    q_hash = valobj.GetNonSyntheticValue().GetChildMemberWithName("q_hash")
    return qhash._nodes(q_hash) if q_hash.IsValid() else []


def qset_summary(valobj, internal_dict):
    nodes = _nodes(valobj)
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display, so an unrecognised layout must produce ""
    # instead.
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    return "%s (size = %d)" % (type_name, len(nodes)) if type_name else ""


class QSetSyntheticProvider:
    def __init__(self, valobj, internal_dict):
        self.valobj = valobj
        self.update()

    def update(self):
        # The synthetic provider is always handed the real (non-synthetic) value.
        self.nodes = _nodes(self.valobj)

    def has_children(self):
        return True

    def num_children(self):
        return len(self.nodes)

    def get_child_index(self, name):
        try:
            return int(name.lstrip("[").rstrip("]"))
        except ValueError:
            return -1

    def get_child_at_index(self, index):
        if index < 0 or index >= len(self.nodes):
            return None
        key = self.nodes[index].GetChildMemberWithName("key")
        return key.Clone("[%d]" % index)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qset.qset_summary -x "^QSet<.*>$"' % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qset.QSetSyntheticProvider -x "^QSet<.*>$"' % category
    )
