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
