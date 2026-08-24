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
