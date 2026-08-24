# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QString's "d" is a QArrayDataPointer<char16_t> (same shape as QVector's, see qvector.py),
# holding "ptr" (the UTF-16 data) and "size" (qsizetype, in UTF-16 code units).

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
    # Matches Qt's own QDebug::putString()/putEscapedString(): printable ASCII passes
    # through as-is, everything else (including '"' and '\\') is backslash-escaped, with
    # non-printable/non-ASCII characters falling back to \uXXXX.
    out = []
    for ch in text:
        code = ord(ch)
        if code in _ESCAPES:
            out.append(_ESCAPES[code])
        elif 0x20 <= code < 0x7F:
            out.append(ch)
        else:
            out.append("\\u%04x" % code)
    return "".join(out)


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
    raw = valobj.GetProcess().ReadMemory(ptr.GetValueAsUnsigned(), length * 2, error)
    if not error.Success():
        return None
    return '"%s"' % _escape(raw.decode("utf-16-le", errors="replace"))


def qstring_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qstring.qstring_summary -x "^QString$"' % category
    )
