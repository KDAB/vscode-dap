# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

cmake_minimum_required(VERSION 3.12)
project(gdb_dap_test)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)
find_package(Qt6 REQUIRED COMPONENTS Core)

add_executable(test1 test1.cpp)
target_link_libraries(test1 Qt6::Core)
add_executable(test_args test_args.cpp)
add_executable(test_env test_env.cpp)
add_executable(test_attach test_attach.cpp)
target_link_libraries(test_attach Threads::Threads)
add_executable(test_crash test_crash.cpp)
