# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

from . import _common


def qrectf_summary(valobj, internal_dict):
    x = valobj.GetChildMemberWithName("xp")
    y = valobj.GetChildMemberWithName("yp")
    w = valobj.GetChildMemberWithName("w")
    h = valobj.GetChildMemberWithName("h")
    if not x.IsValid() or not y.IsValid() or not w.IsValid() or not h.IsValid():
        return None
    # same output as QDebug operator<<(QRectF): unlike QRect this stores
    # width/height directly rather than a second corner.
    return "QRectF(%g,%g %gx%g)" % (
        _common.double(x),
        _common.double(y),
        _common.double(w),
        _common.double(h),
    )


def register(debugger, category):
    debugger.HandleCommand(
        'type summary add -w %s -F qt.qrectf.qrectf_summary -x "^QRectF$"' % category
    )
