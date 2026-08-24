# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QByteArray's "d" is a QArrayDataPointer<char> (same shape as QString's, see qstring.py),
# holding "ptr" (the raw bytes) and "size" (qsizetype). Its QDebug operator escapes byte-by-byte
# exactly like QUtf8StringView's - reused here via escape_bytes() rather than duplicated - since
# both treat their content as opaque bytes rather than decoding it as text.

import lldb

from . import qutf8stringview


def format_value(valobj):
    d = valobj.GetChildMemberWithName("d")
    if not d.IsValid():
        return None
    ptr = d.GetChildMemberWithName("ptr")
    size = d.GetChildMemberWithName("size")
    if not ptr.IsValid() or not size.IsValid():
        return None
    length = size.GetValueAsSigned()
    if length <= 0:
        return '""'
    error = lldb.SBError()
    raw = valobj.GetProcess().ReadMemory(ptr.GetValueAsUnsigned(), length, error)
    if not error.Success():
        return None
    return '"%s"' % qutf8stringview.escape_bytes(raw)


def qbytearray_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qbytearray.qbytearray_summary -x "^QByteArray$"' % category
    )
