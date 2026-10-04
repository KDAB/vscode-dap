// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

// Exercises mixed C++/QML call stacks. Click the button, with a breakpoint on
// the line marked BREAKPOINT: the stack should be
// C++ (multiply) -> C++ (Backend::compute) -> QML (innerHandler) ->
// QML (outerHandler) -> QML (onClicked) -> QML engine -> Qt Quick C++.
// The "computed" signal then re-enters QML, which calls Backend::report, so a
// breakpoint there shows C++ -> QML -> C++ -> QML -> C++.

#include <cstdio>

#include <QGuiApplication>
#include <QObject>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QUrl>

int multiply(int a, int b) {
  int product = a * b;
  return product; // BREAKPOINT
}

class Backend : public QObject {
  Q_OBJECT

public:
  Q_INVOKABLE int compute(int a, int b) {
    int result = multiply(a, b);
    emit computed(result);
    return result;
  }

  Q_INVOKABLE void report(int value) {
    printf("report: %d\n", value); // BREAKPOINT (re-entrant path)
  }

signals:
  void computed(int value);
};

int main(int argc, char **argv) {
  QGuiApplication app(argc, argv);

  Backend backend;
  QQmlApplicationEngine engine;
  engine.rootContext()->setContextProperty("backend", &backend);
  engine.load(QUrl::fromLocalFile(TEST_QTQUICK_QML));
  if (engine.rootObjects().isEmpty()) {
    return 1;
  }

  return app.exec();
}

#include "test_qtquick.moc"
