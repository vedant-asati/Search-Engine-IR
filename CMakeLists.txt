cmake_minimum_required(VERSION 3.15)
project(mini_search_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Define directories for downloads
set(HTTPLIB_PATH "${CMAKE_CURRENT_SOURCE_DIR}/httplib.h")
set(JSON_PATH "${CMAKE_CURRENT_SOURCE_DIR}/nlohmann/json.hpp")

# Download cpp-httplib header-only HTTP library if it doesn't exist
if(NOT EXISTS ${HTTPLIB_PATH})
    message(STATUS "Downloading httplib.h from GitHub...")
    file(DOWNLOAD "https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h" ${HTTPLIB_PATH}
         SHOW_PROGRESS
         STATUS DOWNLOAD_STATUS)
    list(GET DOWNLOAD_STATUS 0 STATUS_CODE)
    if(NOT STATUS_CODE EQUAL 0)
        message(FATAL_ERROR "Failed to download httplib.h. Error: ${DOWNLOAD_STATUS}")
    endif()
endif()

# Download nlohmann/json header-only JSON library if it doesn't exist
if(NOT EXISTS ${JSON_PATH})
    message(STATUS "Downloading nlohmann/json.hpp from GitHub...")
    file(DOWNLOAD "https://raw.githubusercontent.com/nlohmann/json/develop/single_include/nlohmann/json.hpp" ${JSON_PATH}
         SHOW_PROGRESS
         STATUS DOWNLOAD_STATUS)
    list(GET DOWNLOAD_STATUS 0 STATUS_CODE)
    if(NOT STATUS_CODE EQUAL 0)
        message(FATAL_ERROR "Failed to download json.hpp. Error: ${DOWNLOAD_STATUS}")
    endif()
endif()

# Windows sockets library is required for cpp-httplib on Windows
if(WIN32)
    add_compile_definitions(_WIN32_WINNT=0x0A00) # Target Windows 10 or later for sockets
endif()

# Include the source directory so that #include "nlohmann/json.hpp" works
include_directories(${CMAKE_CURRENT_SOURCE_DIR})

add_executable(mini_search_engine 
    main.cpp
    engine.cpp
    engine.hpp
)

if(WIN32)
    target_link_libraries(mini_search_engine PRIVATE ws2_32)
endif()

add_executable(dataset_converter
    converter/DatasetConverter.cpp
)
