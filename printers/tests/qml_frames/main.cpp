// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <QCoreApplication>
#include <QDebug>
#include <QObject>
#include <QQmlComponent>
#include <QQmlContext>
#include <QQmlEngine>
#include <QUrl>

// Where the probe stops. Reached as main.qml's Component.onCompleted ->
// outer() -> inner() -> Backend::compute(), which emits computed(), whose QML
// handler calls Backend::report() -> stopHere(): two stretches of QML, each
// between C++ frames.
__attribute__((noinline)) void stopHere(int value)
{
    asm volatile("" : : "r"(value) : "memory");
}

class Backend : public QObject
{
    Q_OBJECT

public:
    Q_INVOKABLE int compute(int value)
    {
        emit computed(value * 2);
        return value;
    }

    Q_INVOKABLE void report(int value)
    {
        stopHere(value);
    }

Q_SIGNALS:
    void computed(int value);
};

int main(int argc, char **argv)
{
    // QtQml only, no GUI: nothing here needs a display.
    QCoreApplication app(argc, argv);

    Backend backend;
    QQmlEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("backend"), &backend);

    // Loaded from the source tree rather than embedded, so that a QML frame
    // has a real file behind it, as it would in an application.
    QQmlComponent component(&engine, QUrl::fromLocalFile(QStringLiteral(MAIN_QML)));
    QObject *root = component.create();
    if (!root) {
        qWarning() << component.errors();
        return 1;
    }
    delete root;
    return 0;
}

#include "main.moc"
