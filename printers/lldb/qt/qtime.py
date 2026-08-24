# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QTime's only member is "mds" (int), milliseconds since midnight. An invalid QTime stores -1
# there (there's no separate validity flag).
#
# The reference gdb printer's own format for a valid time is the bare "HH:mm:ss.zzz" string with
# no "QTime(" wrapper at all (matching Qt::ISODate) - confirmed against
# tests/run_gdb_printers.sh's output - and, unlike QDate's, its handling of an invalid QTime is
# already sensible ("invalid QTime", no garbage), so that format is kept for the invalid case too
# rather than falling back to real QDebug's own "QTime(Invalid)".

_INVALID_MDS = -1

_MS_PER_HOUR = 3600000
_MS_PER_MINUTE = 60000
_MS_PER_SECOND = 1000


def format_value(valobj):
    mds = valobj.GetChildMemberWithName("mds")
    if not mds.IsValid():
        return None
    value = mds.GetValueAsSigned()
    if value == _INVALID_MDS:
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
