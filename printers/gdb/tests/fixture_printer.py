# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""A map-hinted pretty printer for main.cpp's Table, for the test only.

Modelled on the KDevelop Qt printers' QHash printer: a gdb.ValuePrinter whose
display_hint() is "map", whose children() yield a flat [i].key, [i].value
sequence, and whose num_children() counts those flat children rather than the
entries. Nothing but a real Qt build would otherwise cover that shape, and this
test deliberately needs neither Qt nor a printer download.
"""

import gdb


class TablePrinter(gdb.ValuePrinter):
    def __init__(self, val):
        self._val = val

    def to_string(self):
        return "Table (size = %d)" % (self.num_children() // 2)

    def num_children(self):
        return 4

    def children(self):
        for i in range(self.num_children() // 2):
            yield ("[%d].key" % i, self._val["keys"][i])
            yield ("[%d].value" % i, self._val["values"][i])

    def display_hint(self):
        return "map"


def _lookup(val):
    if val.type.strip_typedefs().tag == "Table":
        return TablePrinter(val)
    return None


gdb.pretty_printers.append(_lookup)
