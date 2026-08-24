# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QMultiMap<Key, T> has the exact same layout as QMap<Key, T> (see qmap.py) - down to the
# QExplicitlySharedDataPointerV2<QMapData<...>> wrapper - except the "m" member it reaches
# through is a std::multimap rather than a std::map, so this reuses qmap.py's _std_map()
# unmodified: LLDB's own std::multimap synthetic children provider exposes the same
# GetNumChildren()/GetChildAtIndex() interface std::map's does. A repeated key's values come out
# in most-recently-inserted-first order, because that's the order QMultiMap::insert() itself
# builds the underlying std::multimap in (each insert goes to the front of that key's run), and
# walking the raw tree preserves whatever order is actually stored.

from . import qmap


def qmultimap_summary(valobj, internal_dict):
    m = qmap._std_map(valobj)
    size = m.GetNumChildren() if m is not None else 0
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display, so an unrecognised layout must produce ""
    # instead.
    type_name = valobj.GetNonSyntheticValue().GetType().GetName()
    return "%s (size = %d)" % (type_name, size) if type_name else ""


class QMultiMapSyntheticProvider(qmap.QMapSyntheticProvider):
    # A repeated key produces several children with the same "[key]" display name; get_child_index()
    # (inherited from QMapSyntheticProvider) resolves that ambiguity by returning the first match,
    # same as QMap's own already does for any hypothetical duplicate.
    pass


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -e -F qt.qmultimap.qmultimap_summary -x "^QMultiMap<.*>$"'
        % category
    )
    debugger.HandleCommand(
        'type synthetic add -w %s -l qt.qmultimap.QMultiMapSyntheticProvider -x "^QMultiMap<.*>$"'
        % category
    )
