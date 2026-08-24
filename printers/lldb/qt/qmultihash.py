# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QMultiHash<Key, T>'s "d" is the exact same QHashPrivate::Data<Node>* span/bucket layout QHash's
# is (see qhash.py's own comment), just with Node = QHashPrivate::MultiNode<Key, T> instead of
# plain Node<Key, T>: a MultiNode's "value" isn't T itself but a "Chain *" (MultiNodeChain<T>),
# a singly linked list of one-value-per-insert nodes. QMultiHash::insertMulti() always links a
# new value in as the new head, so walking a chain front-to-back yields
# most-recently-inserted-first, matching QMultiHash's own documented iteration order - and
# because a bucket only ever holds one Node no matter how many values its key has accumulated,
# qhash.py's own _nodes() (span-walking, bucket-order) is reused unmodified to find those nodes;
# this module only adds the per-node chain walk on top.

from . import _common, qhash


def _entries(valobj):
    entries = []
    for node in qhash._nodes(valobj):
        key = node.GetChildMemberWithName("key")
        chain = node.GetChildMemberWithName("value")
        chain_type = chain.GetType().GetPointeeType()
        address = chain.GetValueAsUnsigned()
        while address:
            chain_value = chain.CreateValueFromAddress("chain", address, chain_type)
            entries.append((key, chain_value.GetChildMemberWithName("value")))
            address = chain_value.GetChildMemberWithName("next").GetValueAsUnsigned()
    return entries


def qmultihash_summary(valobj, internal_dict):
    entries = _entries(valobj)
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display, so an unrecognised layout must produce ""
    # instead.
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    return "%s (size = %d)" % (type_name, len(entries)) if type_name else ""


class QMultiHashSyntheticProvider:
    def __init__(self, valobj, internal_dict):
        self.valobj = valobj
        self.update()

    def update(self):
        # The synthetic provider is always handed the real (non-synthetic) value.
        self.entries = _entries(self.valobj)

    def has_children(self):
        return True

    def num_children(self):
        return len(self.entries)

    def get_child_index(self, name):
        for i, (key, _) in enumerate(self.entries):
            if name == "[%s]" % _common.key_text(key):
                return i
        return -1

    def get_child_at_index(self, index):
        if index < 0 or index >= len(self.entries):
            return None
        key, value = self.entries[index]
        return value.Clone("[%s]" % _common.key_text(key))


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qmultihash.qmultihash_summary -x "^QMultiHash<.*>$"'
        % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qmultihash.QMultiHashSyntheticProvider '
        '-x "^QMultiHash<.*>$"' % category
    )
