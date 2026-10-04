// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import QtQml

QtObject {
    function inner(value) {
        return backend.compute(value);
    }

    function outer(value) {
        return inner(value + 1);
    }

    property Connections connections: Connections {
        target: backend

        function onComputed(value) {
            backend.report(value);
        }
    }

    Component.onCompleted: outer(20)
}
