# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QHash<Key, T>'s "d" is a QHashPrivate::Data<Node>* (null for a default-constructed hash),
# split into "spans" of 128 buckets each (QHashPrivate::SpanConstants in qtbase's qhash.h).
# Each Span has an "offsets[128]" array mapping a bucket's low bits to a slot in that span's
# "entries" array, or 0xff (UnusedEntry) if the bucket is empty; Node itself is a plain
# "Key key; T value;" struct. Walking buckets 0..d->numBuckets-1 in order and skipping empty
# ones matches QHash's own iteration order (and therefore QDebug's) - it depends on the hash
# seed, not insertion order, so QHashSeed::setDeterministicGlobalSeed() matters for
# reproducing a specific order (see tests/main.cpp).

from . import _common

_SPAN_ENTRIES = 128  # QHashPrivate::SpanConstants::NEntries (1 << SpanShift, SpanShift == 7)
_UNUSED_ENTRY = 0xFF  # QHashPrivate::SpanConstants::UnusedEntry


def _nodes(valobj):
    real = valobj.GetNonSyntheticValue()
    d = real.GetChildMemberWithName("d")
    if not d.IsValid() or d.GetValueAsUnsigned() == 0:
        return []

    node_type = d.GetType().GetPointeeType().GetTemplateArgumentType(0)
    data = d.Dereference()
    num_buckets = data.GetChildMemberWithName("numBuckets").GetValueAsUnsigned()
    spans = data.GetChildMemberWithName("spans")
    span_type = spans.GetType().GetPointeeType()
    span_size = span_type.GetByteSize()
    spans_addr = spans.GetValueAsUnsigned()

    nodes = []
    for bucket in range(num_buckets):
        span_index, local_index = divmod(bucket, _SPAN_ENTRIES)
        span = spans.CreateValueFromAddress(
            "span", spans_addr + span_index * span_size, span_type
        )
        offset = (
            span.GetChildMemberWithName("offsets")
            .GetChildAtIndex(local_index)
            .GetValueAsUnsigned()
        )
        if offset == _UNUSED_ENTRY:
            continue
        entries = span.GetChildMemberWithName("entries")
        entry_size = entries.GetType().GetPointeeType().GetByteSize()
        node_addr = entries.GetValueAsUnsigned() + offset * entry_size
        nodes.append(entries.CreateValueFromAddress("node", node_addr, node_type))
    return nodes


def qhash_summary(valobj, internal_dict):
    nodes = _nodes(valobj)
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display, so an unrecognised layout must produce ""
    # instead.
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    return "%s (size = %d)" % (type_name, len(nodes)) if type_name else ""


class QHashSyntheticProvider:
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
        for i, node in enumerate(self.nodes):
            key = _common.key_text(node.GetChildMemberWithName("key"))
            if name == "[%s]" % key:
                return i
        return -1

    def get_child_at_index(self, index):
        if index < 0 or index >= len(self.nodes):
            return None
        node = self.nodes[index]
        key = _common.key_text(node.GetChildMemberWithName("key"))
        return node.GetChildMemberWithName("value").Clone("[%s]" % key)


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qhash.qhash_summary -x "^QHash<.*>$"' % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qhash.QHashSyntheticProvider -x "^QHash<.*>$"'
        % category
    )
