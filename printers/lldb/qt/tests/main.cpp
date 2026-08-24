// SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <QByteArray>
#include <QChar>
#include <QDate>
#include <QHash>
#include <QHashSeed>
#include <QLatin1String>
#include <QLine>
#include <QLineF>
#include <QList>
#include <QMap>
#include <QMultiHash>
#include <QMultiMap>
#include <QPoint>
#include <QQueue>
#include <QRect>
#include <QSet>
#include <QSize>
#include <QStack>
#include <QString>
#include <QStringList>
#include <QStringView>
#include <QTime>
#include <QUrl>
#include <QUtf8StringView>
#include <QUuid>
#include <QVector>

// The runners break here and inspect the frame above, so main() can grow new
// values without any line number in test.sh needing an update.
__attribute__((noinline)) void stopHere()
{
}

int main()
{
    // QHash's bucket order depends on the hash seed, which is randomised per process by
    // default; pin it so the printer's output (and this test's expected.txt) is reproducible.
    QHashSeed::setDeterministicGlobalSeed();

    QPoint p(10, 20);
    QPoint origin;
    QPoint negative(-5, -7);

    QPointF pf(1.5, 2.5);
    QPointF pfZero(0, 0);
    QPointF pfNegative(-1.25, -3.75);

    QSize sz(30, 40);
    QSize szZero(0, 0);
    QSize szNegative(-1, -1);

    QSizeF szf(30.5, 40.5);
    QSizeF szfZero(0, 0);

    QRect r(1, 2, 30, 40);
    QRect rZero(0, 0, 0, 0);
    QRect rNegative(-1, -2, 10, 10);

    QRectF rf(1.5, 2.5, 30.5, 40.5);
    QRectF rfZero(0, 0, 0, 0);

    QLine ln(QPoint(1, 2), QPoint(3, 4));
    QLine lnZero(QPoint(0, 0), QPoint(0, 0));

    QLineF lnf(QPointF(1.5, 2.5), QPointF(3.5, 4.5));

    QVector<int> vec = {1, 2, 3};
    QVector<int> vecEmpty;

    QList<int> list = {1, 2, 3};
    QList<int> listEmpty;

    QStringList sl = {"one", "two"};
    QStringList slEmpty;

    QQueue<int> queue;
    queue.enqueue(1);
    queue.enqueue(2);
    QQueue<int> queueEmpty;

    QStack<int> stack;
    stack.push(1);
    stack.push(2);
    QStack<int> stackEmpty;

    QString str("hello");
    QString strEmpty("");
    QString strEscaped("he said \"hi\"\nnext");

    QLatin1String l1str("hello");
    QLatin1String l1strEmpty("");
    QLatin1String l1strEscaped("he said \"hi\"\nnext");

    QStringView sv(str);
    QStringView svEmpty(strEmpty);
    QStringView svEscaped(strEscaped);

    QUtf8StringView u8str("hello");
    QUtf8StringView u8strEmpty("");
    QUtf8StringView u8strEscaped("he said \"hi\"\nnext");

    QByteArray ba("hello");
    QByteArray baEmpty("");
    QByteArray baEscaped("he said \"hi\"\nnext");

    QChar qc('A');
    QChar qcControl(0x07);
    QChar qcNonAscii(0x00e9);

    QUuid uuid("{550e8400-e29b-41d4-a716-446655440000}");
    QUuid uuidNull;

    QDate date(2024, 3, 15);
    QDate dateSingleDigit(2024, 1, 5);
    QDate dateInvalid;

    QTime time(13, 45, 30, 500);
    QTime timeMidnight(0, 0, 0, 0);
    QTime timeInvalid;
    // Out of range, so invalid, but not the canonical -1 a default-constructed QTime holds.
    QTime timeOutOfRange = QTime::fromMSecsSinceStartOfDay(90000000);
    QTime timeNegative = QTime::fromMSecsSinceStartOfDay(-2);

    QUrl url("https://user:pass@example.com:8080/path/to/thing?query=1&x=2#frag");
    QUrl urlSimple("https://example.com/");
    QUrl urlInvalid;
    QUrl urlEmpty("");
    // Valid, but everything it holds is the password the printer deliberately never reads.
    QUrl urlPasswordOnly;
    urlPasswordOnly.setPassword("secret");

    QMap<int, QString> map;
    map.insert(1, "one");
    map.insert(2, "two");
    map.insert(3, "three");
    QMap<int, QString> mapEmpty;

    QMultiMap<int, QString> multiMap;
    multiMap.insert(1, "a");
    multiMap.insert(1, "b");
    multiMap.insert(2, "c");
    QMultiMap<int, QString> multiMapEmpty;

    QHash<int, QString> hash;
    hash.insert(1, "one");
    hash.insert(2, "two");
    hash.insert(3, "three");
    QHash<int, QString> hashEmpty;

    QMultiHash<int, QString> multiHash;
    multiHash.insert(1, "a");
    multiHash.insert(1, "b");
    multiHash.insert(2, "c");
    QMultiHash<int, QString> multiHashEmpty;

    QSet<int> set;
    set.insert(1);
    set.insert(2);
    set.insert(3);
    QSet<int> setEmpty;

    QMap<QString, int> mapStringKey;
    mapStringKey.insert("apple", 1);
    mapStringKey.insert("banana", 2);

    QHash<QString, int> hashStringKey;
    hashStringKey.insert("apple", 1);
    hashStringKey.insert("banana", 2);

    stopHere();
    return 0;
}
