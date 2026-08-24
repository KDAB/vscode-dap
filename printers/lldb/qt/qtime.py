# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QTime's only member is "mds" (int), milliseconds since midnight. There's no separate validity
# flag: a default-constructed QTime stores -1 there, and QTime::isValid() is just a range check
# on that one value, "uint(mds) < MSECS_PER_DAY" - so anything negative or past the end of a day
# is invalid, not only the canonical -1. Uninitialised memory reaches a debugger far more often
# than it reaches a program, so that whole range is worth honouring here: the same range check is
# used below, rather than the reference gdb printer's "mds == -1", which is the one respect in
# which this doesn't follow the reference. The reference prints garbage clock readings for the
# rest of the invalid range ("25:00:00.000" for 90000000, "-1:59:59.998" for -2, where Qt's own
# QDebug says QTime(Invalid) for both) - the same kind of breakage qdate.py already declines to
# reproduce for QDate's invalid case.
#
# Otherwise the reference's format is kept: the bare "HH:mm:ss.zzz" string with no "QTime("
# wrapper at all (matching Qt::ISODate), and its "invalid QTime" text, both confirmed against
# tests/run_gdb_printers.sh's output. That text is already sensible, so there's no reason to fall
# back to real QDebug's own "QTime(Invalid)" the way qdate.py has to for QDate.

_MS_PER_DAY = 86400000

_MS_PER_HOUR = 3600000
_MS_PER_MINUTE = 60000
_MS_PER_SECOND = 1000


def format_value(valobj):
    mds = valobj.GetChildMemberWithName("mds")
    if not mds.IsValid():
        return None
    value = mds.GetValueAsSigned()
    # QTime::isValid()'s own check, covering the canonical -1 along with every other out-of-range
    # value - see the module comment.
    if not 0 <= value < _MS_PER_DAY:
        return "invalid QTime"
    hours, value = divmod(value, _MS_PER_HOUR)
    minutes, value = divmod(value, _MS_PER_MINUTE)
    seconds, millis = divmod(value, _MS_PER_SECOND)
    return "%02d:%02d:%02d.%03d" % (hours, minutes, seconds, millis)


def qtime_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qtime.qtime_summary -x "^QTime$"' % category
    )
