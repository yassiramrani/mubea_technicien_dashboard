@echo off
title Mubea Dashboard
setlocal

echo =========================================
echo       Mubea Technician Dashboard
echo =========================================
echo.

:: Define paths for pre-packaged Portable Node
set "BASE_DIR=%~dp0"
set "NODE_DIR=%BASE_DIR%node_portable"
set "NPM_CLI=%NODE_DIR%\npm.cmd"

echo [INFO] Using embedded offline Node.js engine. No download required!
echo.

:: Check for incomplete installation (if .bin\next is missing, it failed last time)
IF EXIST "%BASE_DIR%node_modules\.bin\next" goto :SKIP_INSTALL

echo [1/2] First time setup: Installing dependencies...
:: Disabling strict SSL in case of corporate firewall/proxy interception
call "%NPM_CLI%" install --strict-ssl=false
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies. The Mubea proxy is blocking the download.
    echo Please connect to a Mobile Hotspot for 1 minute to complete the setup!
    pause
    exit /b 1
)
echo.

echo [2/2] Building the application for production...
call "%NPM_CLI%" run build
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build the application.
    pause
    exit /b 1
)
echo.

:SKIP_INSTALL

echo Starting the server...
echo The dashboard will open in your browser shortly!
timeout /t 3 /nobreak > NUL
start http://localhost:3000
call "%NPM_CLI%" start
pause
