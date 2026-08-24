# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

"""Map-hinted pretty printers for main.cpp's Table and Registry, for the test only.

Both are gdb.ValuePrinters whose display_hint() is "map" and whose children()
yield a flat [i].key, [i].value sequence; they differ in what num_children()
counts, which is the one thing map-hinted printers in the wild disagree about:

  TablePrinter counts the flat children, as the pretty-printing API defines it
  and as the KDevelop Qt printers' QHash printer does.

  RegistryPrinter counts the entries - half of what children() yields - as
  libstdc++'s std::map and std::unordered_map printers do between gcc
  de124ffe1439 and gcc b80a4347fc63.

The fixup must render both correctly, and only a printer of its own covers the
second shape on a machine whose libstdc++ is older or newer than that window.
Nothing here needs Qt or a printer download.
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


class RegistryPrinter(gdb.ValuePrinter):
    def __init__(self, val):
        self._val = val

    def to_string(self):
        return "Registry (size = %d)" % self.num_children()

    def num_children(self):
        # One entry, two children: the count libstdc++ reports for a
        # single-element map, which a consumer that halves it turns into none.
        return 1

    def children(self):
        yield ("[0].key", self._val["key"])
        yield ("[0].value", self._val["value"])

    def display_hint(self):
        return "map"


def _lookup(val):
    tag = val.type.strip_typedefs().tag
    if tag == "Table":
        return TablePrinter(val)
    if tag == "Registry":
        return RegistryPrinter(val)
    return None


gdb.pretty_printers.append(_lookup)
