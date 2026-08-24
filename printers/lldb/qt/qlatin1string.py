# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QLatin1String is "using QLatin1String = QLatin1StringView;" (qstringfwd.h); its two members
# are "m_data" (const char *, not owned) and "m_size" (qsizetype). Unlike QString/QStringView's
# QDebug operator (see qstringview.py), which only escapes C0 control characters and DEL and
# leaves the rest of Unicode as literal text, QLatin1String's is byte-oriented and \uXXXX-escapes
# anything outside printable ASCII, including the upper half of Latin-1.

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


def _escape(raw):
    out = []
    for byte in raw:
        if byte in _ESCAPES:
            out.append(_ESCAPES[byte])
        elif 0x20 <= byte < 0x7F:
            out.append(chr(byte))
        else:
            out.append("\\u%04X" % byte)
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
    raw = valobj.GetProcess().ReadMemory(data.GetValueAsUnsigned(), length, error)
    if not error.Success():
        return None
    return '"%s"' % _escape(raw)


def qlatin1string_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qlatin1string.qlatin1string_summary -x "^QLatin1String$"'
        % category
    )
