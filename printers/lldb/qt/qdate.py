# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QDate's only member is "jd" (qint64), a Julian day number - the same one std::chrono's
# calendar types and Howard Hinnant's civil_from_days() algorithm (used here) both use, give or
# take the epoch: Qt's jd 2440588 is 1970-01-01, the day civil_from_days() itself is zero for, so
# converting is just "jd - 2440588" before handing it to that algorithm. An invalid QDate stores
# the minimum qint64 in "jd" (there's no separate validity flag).
#
# The reference gdb printer's own format for a valid date is the bare ISO string with no "QDate("
# wrapper at all (matching Qt::ISODate, e.g. "2024-03-15") - confirmed against
# tests/run_gdb_printers.sh's output. Its handling of an invalid QDate is broken, though (it
# prints garbage built from the raw jd value instead of a sensible fallback), so that one case
# instead matches real Qt's own QDebug operator, confirmed the same way as
# QLatin1String/QStringView's formats: compiling and running qDebug() << value against a real Qt
# build.

_INVALID_JD = -9223372036854775808  # std::numeric_limits<qint64>::min()


def _civil_from_days(days_since_epoch):
    # Howard Hinnant's civil_from_days(), proleptic Gregorian, days counted from 1970-01-01.
    z = days_since_epoch + 719468
    era = z // 146097 if z >= 0 else (z - 146096) // 146097
    day_of_era = z - era * 146097  # [0, 146096]
    year_of_era = (
        day_of_era - day_of_era // 1460 + day_of_era // 36524 - day_of_era // 146096
    ) // 365  # [0, 399]
    year = year_of_era + era * 400
    day_of_year = day_of_era - (365 * year_of_era + year_of_era // 4 - year_of_era // 100)
    month_prime = (5 * day_of_year + 2) // 153  # [0, 11], March-based
    day = day_of_year - (153 * month_prime + 2) // 5 + 1
    month = month_prime + 3 if month_prime < 10 else month_prime - 9
    if month <= 2:
        year += 1
    return year, month, day


def format_value(valobj):
    jd = valobj.GetChildMemberWithName("jd")
    if not jd.IsValid():
        return None
    value = jd.GetValueAsSigned()
    if value == _INVALID_JD:
        return "QDate(Invalid)"
    year, month, day = _civil_from_days(value - 2440588)
    return "%d-%02d-%02d" % (year, month, day)


def qdate_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qdate.qdate_summary -x "^QDate$"' % category
    )
