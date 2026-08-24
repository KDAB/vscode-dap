# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# Quoting/escaping only: reading the text out of QString's "d" lives in _common.qstring_text(),
# which qurl.py needs unquoted, so the layout is described (and known) in just that one place.

from . import _common

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
    text = _common.qstring_text(valobj)
    if text is None:
        return None
    return '"%s"' % _escape(text)


def qstring_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qstring.qstring_summary -x "^QString$"' % category
    )
