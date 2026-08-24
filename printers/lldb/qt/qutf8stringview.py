# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QUtf8StringView is "using QUtf8StringView = QBasicUtf8StringView<false>;" (qstringfwd.h); its
# two members are "m_data" (const char *, raw UTF-8 bytes, not owned) and "m_size" (qsizetype,
# in bytes). Its QDebug operator doesn't decode the UTF-8 - it escapes byte-by-byte exactly like
# QByteArray's (see qbytearray.py, which reuses escape_bytes() from here), so a multi-byte UTF-8
# sequence prints as a run of \xXX escapes rather than the literal character it encodes.
#
# The alias itself lives in whichever of the "q_has_char8_t"/"q_no_char8_t" namespaces
# (qstringfwd.h) is the *inline* one for the toolchain's C++ standard - C++20's char8_t makes
# "q_has_char8_t" inline, anything older makes "q_no_char8_t" inline instead - and LLDB's own
# type name for the variable includes that inline namespace qualifier even though it's invisible
# to C++ code, so the regex below has to allow either prefix (or neither, should some LLDB
# version strip it after all).

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


def escape_bytes(raw):
    out = []
    for byte in raw:
        if byte in _ESCAPES:
            out.append(_ESCAPES[byte])
        elif 0x20 <= byte < 0x7F:
            out.append(chr(byte))
        else:
            out.append("\\x%02X" % byte)
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
    return '"%s"' % escape_bytes(raw)


def qutf8stringview_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qutf8stringview.qutf8stringview_summary '
        '-x "^(q_has_char8_t::|q_no_char8_t::)?QUtf8StringView$"' % category
    )
