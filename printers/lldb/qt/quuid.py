# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QUuid's four members mirror the standard RFC 4122 GUID layout: "data1" (uint32), "data2"
# (uint16), "data3" (uint16), and "data4" (uchar[8], the last 8 bytes of the 128-bit value
# verbatim). The reference gdb printer's format is "QUuid({xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx})"
# (lowercase hex) - note the braces are part of its own to_string(), not something LLDB's
# "(QUuid)" prefix already supplies.


def format_value(valobj):
    data1 = valobj.GetChildMemberWithName("data1")
    data2 = valobj.GetChildMemberWithName("data2")
    data3 = valobj.GetChildMemberWithName("data3")
    data4 = valobj.GetChildMemberWithName("data4")
    if not data1.IsValid() or not data2.IsValid() or not data3.IsValid() or not data4.IsValid():
        return None
    bytes4 = [data4.GetChildAtIndex(i).GetValueAsUnsigned() for i in range(8)]
    return "QUuid({%08x-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x})" % (
        data1.GetValueAsUnsigned(),
        data2.GetValueAsUnsigned(),
        data3.GetValueAsUnsigned(),
        bytes4[0],
        bytes4[1],
        bytes4[2],
        bytes4[3],
        bytes4[4],
        bytes4[5],
        bytes4[6],
        bytes4[7],
    )


def quuid_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.quuid.quuid_summary -x "^QUuid$"' % category
    )
