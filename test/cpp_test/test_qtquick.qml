// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import QtQuick
import QtQuick.Controls

Window {
  width: 320
  height: 120
  visible: true
  title: "test_qtquick"

  function innerHandler(a, b) {
    return backend.compute(a, b);
  }

  function outerHandler(a, b) {
    return innerHandler(a, b);
  }

  Button {
    anchors.centerIn: parent
    text: "Click me"
    onClicked: outerHandler(6, 7)
  }

  Connections {
    target: backend
    function onComputed(value) {
      backend.report(value);
    }
  }
}
