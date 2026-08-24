# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# Shared helpers for the type modules below. Not a printer itself, so it is
# not listed in __init__.py's _MODULES.

import lldb


def checked_int(value):
    # Since Qt 6.10 integer coordinates are QtPrivate::QCheckedIntegers::QCheckedInt<int>,
    # before that plain int.
    inner = value.GetChildMemberWithName("m_i")
    if inner.IsValid():
        value = inner
    return value.GetValueAsSigned()


def double(value):
    error = lldb.SBError()
    return value.GetData().GetDouble(error, 0)


def key_text(value):
    # Used for a container's bracketed "[key]" child name (qmap.py, qhash.py). GetValue() only
    # returns text for scalar types (ints, ...); aggregate keys like QString have no value of
    # their own, only a summary, so fall back to that - which also means the key gets whatever
    # quoting/formatting its own registered summary uses (e.g. QString's surrounding quotes).
    return value.GetValue() or value.GetSummary() or "?"


def qstring_text(value):
    # Reads a QString member's raw decoded text, with none of qstring.py's own quoting/escaping -
    # for a type (qurl.py) that needs to splice several QString members back together into one
    # display string of its own, rather than show each one as its own quoted value.
    d = value.GetChildMemberWithName("d")
    if not d.IsValid():
        return None
    ptr = d.GetChildMemberWithName("ptr")
    size = d.GetChildMemberWithName("size")
    if not ptr.IsValid() or not size.IsValid():
        return None
    length = size.GetValueAsSigned()
    if length <= 0:
        return ""
    error = lldb.SBError()
    raw = value.GetProcess().ReadMemory(ptr.GetValueAsUnsigned(), length * 2, error)
    if not error.Success():
        return None
    return raw.decode("utf-16-le", errors="replace")
