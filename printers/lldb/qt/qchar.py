# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QChar's only member is "ucs" (char16_t, a single UTF-16 code unit). Its QDebug operator wraps
# the character in single quotes without escaping the quote or backslash characters themselves
# (there's no parsing ambiguity to worry about with only one character between two fixed
# delimiters) - not even DEL, which prints as a literal raw byte. Only C0 control characters get
# a "\xN" escape (lowercase, as few hex digits as the value needs, unlike QByteArray's fixed
# 2-digit form) and non-ASCII a "\uNNNN" one (lowercase, 4 digits) - confirmed against a real Qt
# build the same way as QLatin1String/QStringView's formats, since QChar has no gdb reference
# printer either.


def format_value(valobj):
    ucs = valobj.GetChildMemberWithName("ucs")
    if not ucs.IsValid():
        return None
    code = ucs.GetValueAsUnsigned()
    if code < 0x20:
        return "'\\x%x'" % code
    if code < 0x80:
        return "'%s'" % chr(code)
    return "'\\u%04x'" % code


def qchar_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qchar.qchar_summary -x "^QChar$"' % category
    )
