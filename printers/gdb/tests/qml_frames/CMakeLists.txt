# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

cmake_minimum_required(VERSION 3.16)
project(kdap_qml_frames_test)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Qml)

add_executable(main main.cpp)
target_compile_definitions(main PRIVATE MAIN_QML="${CMAKE_CURRENT_SOURCE_DIR}/main.qml")
target_link_libraries(main Qt6::Qml)
