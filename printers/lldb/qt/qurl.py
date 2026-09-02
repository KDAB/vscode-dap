# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

# QUrl's only member is "d" (QUrlPrivate *, null for a default-constructed/invalid QUrl).
# QUrlPrivate itself is defined only in qtbase's qurl.cpp, never in any header, so - unlike every
# other type here - its layout can't be had from the debuggee's own debug info (see README.md).
# Rather than depend on QtCore's own binaries carrying it, this walks QUrlPrivate's relevant
# prefix at byte offsets pinned by hand from qtbase's source, the same technique the reference
# gdb printer uses, which works whether Qt was built with debug info or not.
#
# Of those members, "port" (int, -1 when absent) and six of the seven QStrings are read via
# _common.qstring_text(), which returns their raw decoded text rather than qstring.py's own
# quoted/escaped display form, since these get spliced back together into one URL string here
# rather than shown individually. "password" is the seventh, and is deliberately never read: both
# the reference gdb printer and Qt's own QDebug operator<<(QUrl) omit it from their default
# display, and this follows suit.
#
# This only reassembles the common "scheme://[user@]host[:port]path[?query][#fragment]" shape;
# schemes with no authority component (e.g. "mailto:foo@example.com") aren't handled specially,
# on the same "good enough for debugging, not a full URI-spec reimplementation" basis as
# qdate.py skipping negative/BCE years. (The reference has the same gap, and says so: "TODO:
# always adding // is apparently not compliant in all cases".)
#
# One deliberate departure from the reference: it nests both the user name and the port inside
# its "is there a host" branch, so it drops them entirely for a hostless URL, printing
# "http:///path" for "http://user@/path". Here they're appended on their own terms, keeping
# "http://user@/path" and "http://:8080/path" intact - showing a component that is really there
# beats matching the reference byte for byte.
#
# The reference gdb printer's own format for a valid URL is the bare re-assembled string (no
# "QUrl(...)" wrapper, matching QDate/QTime's own bare convention) and, for an invalid one,
# "<invalid>" - both confirmed against tests/run_gdb_printers.sh's output, and both kept here:
# unlike QDate's invalid case, the reference's QUrl handling isn't broken.
#
# "<empty>" is this printer's own, though: re-assembly yielding nothing has to be told apart from
# format_value() returning None, since an empty summary makes LLDB drop the summary and expand
# the struct instead, showing the raw "d" pointer this printer exists to replace. QUrl("") lands
# here (it allocates a "d", so it isn't the "<invalid>" case, even though QUrl::isValid() is
# false for it) and so does the one valid URL that can re-assemble to nothing: a QUrl carrying
# only a password, which is deliberately not read. Hence "<empty>" rather than reusing
# "<invalid>", which would be an outright false claim about the latter.

import lldb

from . import _common

# QUrlPrivate's layout, pinned by hand from qtbase's qurl.cpp rather than read from debug info:
# "QAtomicInt ref; int port;" followed by these seven QStrings, in this order.
_STRING_MEMBERS = ("scheme", "userName", "password", "host", "path", "query", "fragment")

# "password" is deliberately never read (see above); it is in _STRING_MEMBERS only so that the
# members after it land at the right offset.
_READ_MEMBERS = tuple(name for name in _STRING_MEMBERS if name != "password")


def format_value(valobj):
    d = valobj.GetChildMemberWithName("d")
    if not d.IsValid():
        return None
    address = d.GetValueAsUnsigned()
    if address == 0:
        return "<invalid>"
    target = valobj.GetTarget()
    # "int" is a builtin type, so it resolves regardless of debug info; QString is declared in a
    # header the debuggee's own translation unit includes, so its layout always comes from the
    # debuggee. Neither is the problem QUrlPrivate is (see above).
    int_type = target.GetBasicType(lldb.eBasicTypeInt)
    string_type = target.FindFirstType("QString")
    if not string_type.IsValid():
        return None
    # Walk the members in declaration order, the same cursor walk the reference printer does.
    offset = int_type.GetByteSize()  # past "ref"
    port_value = d.CreateValueFromAddress("port", address + offset, int_type)
    offset += int_type.GetByteSize()
    # None from qstring_text() means the member couldn't be read at all, which is not the same
    # thing as an absent component, so every one of them has to be checked before any is used:
    # letting a None through would just make that component test as falsy below and silently
    # drop out of the URL, turning a failed read into a plausible-looking wrong answer.
    texts = {}
    for name in _STRING_MEMBERS:
        if name in _READ_MEMBERS:
            member = d.CreateValueFromAddress(name, address + offset, string_type)
            texts[name] = _common.qstring_text(member)
        offset += string_type.GetByteSize()
    if any(text is None for text in texts.values()) or not port_value.IsValid():
        return None
    scheme, user_name, host, path, query, fragment = (texts[name] for name in _READ_MEMBERS)
    parts = []
    if scheme:
        parts.append(scheme + "://")
    if user_name:
        parts.append(user_name + "@")
    parts.append(host)
    port = port_value.GetValueAsSigned()
    if port != -1:
        parts.append(":%d" % port)
    parts.append(path)
    if query:
        parts.append("?" + query)
    if fragment:
        parts.append("#" + fragment)
    # See the module comment for why an empty re-assembly can't just be returned as "".
    return "".join(parts) or "<empty>"


def qurl_summary(valobj, internal_dict):
    # LLDB renders a summary function's None return as the literal text "None" rather than
    # falling back to the default struct display.
    return format_value(valobj) or ""


def register(debugger, category):
    debugger.HandleCommand('type summary add -w %s -F qt.qurl.qurl_summary -x "^QUrl$"' % category)
