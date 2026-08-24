# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QStringView's two members are "m_data" (a char16_t * to UTF-16 code units, not owned - the
# same data QString itself stores, see qstring.py's "d.ptr") and "m_size" (qsizetype, in UTF-16
# code units). Unlike QLatin1String's byte-oriented QDebug operator (qlatin1string.py), which
# \uXXXX-escapes anything outside printable ASCII, QStringView's only escapes C0 control
# characters and DEL, leaving the rest of Unicode - including astral characters - as literal
# text.

import lldb

_ESCAPES = {
    0x08: "\\b",
    0x09: "\\t",
    0x0A: "\\n",
    0x0C: "\\f",
    0x0D: "\\r",
    0x22: '\\"',
    0x5C: "\\\\",
}


def _escape(text):
    out = []
    for ch in text:
        code = ord(ch)
        if code in _ESCAPES:
            out.append(_ESCAPES[code])
        elif code < 0x20 or code == 0x7F:
            out.append("\\u%04X" % code)
        else:
            out.append(ch)
    return "".join(out)


def format_value(valobj):
    data = valobj.GetChildMemberWithName("m_data")
    size = valobj.GetChildMemberWithName("m_size")
    if not data.IsValid() or not size.IsValid():
        return None
    length = size.GetValueAsSigned()
    if length <= 0:
        return '""'
    error = lldb.SBError()
    raw = valobj.GetProcess().ReadMemory(data.GetValueAsUnsigned(), length * 2, error)
    if not error.Success():
        return None
    return '"%s"' % _escape(raw.decode("utf-16-le", errors="replace"))


def qstringview_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qstringview.qstringview_summary -x "^QStringView$"'
        % category
    )
