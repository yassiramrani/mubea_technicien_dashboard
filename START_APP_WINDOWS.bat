@echo off
title Mubea Maintaining Inventory
setlocal

echo =========================================
echo   Mubea Maintaining Inventory
echo =========================================
echo.

:: The original offline bundle shipped a portable Node.js runtime in
:: "node_portable". If that folder is missing, fall back to a normal Node.js
:: installation instead of failing with a confusing proxy message.
set "BASE_DIR=%~dp0"
set "NODE_DIR=%BASE_DIR%node_portable"

set "NPM_CLI=%NODE_DIR%\npm.cmd"
if exist "%NODE_DIR%\npm.cmd" goto :RUNTIME_OK

set "NPM_CLI=npm"
where npm > NUL 2>&1
if errorlevel 1 goto :NO_RUNTIME
echo [INFO] node_portable not found - using the Node.js installed on this PC.
goto :RUNTIME_OK

:NO_RUNTIME
echo [ERROR] No Node.js runtime found.
echo.
echo Looked for the embedded engine at:
echo     "%NODE_DIR%\npm.cmd"
echo ...and for "npm" on the PATH. Neither exists.
echo.
echo Install Node.js LTS, reopen this window, then run this script again:
echo     winget install OpenJS.NodeJS.LTS --scope user
echo.
pause
exit /b 1

:RUNTIME_OK
echo.

:: Check for incomplete installation (if .bin\next is missing, it failed last time)
IF EXIST "%BASE_DIR%node_modules\.bin\next" goto :SKIP_INSTALL

echo [1/3] First time setup: Installing dependencies...
:: Disabling strict SSL in case of corporate firewall/proxy interception
call "%NPM_CLI%" install --strict-ssl=false
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    echo If the Mubea proxy blocks the download, connect to a Mobile Hotspot
    echo for 1 minute to complete the setup, then run this script again!
    pause
    exit /b 1
)
echo.

:SKIP_INSTALL

:: The production server needs a compiled build; create one only if it is missing.
IF EXIST "%BASE_DIR%.next\BUILD_ID" goto :SKIP_BUILD

echo [2/3] Building the application for production...
call "%NPM_CLI%" run build
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build the application.
    echo Make sure a .env file containing DATABASE_URL and DIRECT_URL sits
    echo next to this script, then run this script again.
    pause
    exit /b 1
)
echo.

:SKIP_BUILD

echo [3/3] Starting the server...
echo The dashboard will open in your browser shortly!
timeout /t 3 /nobreak > NUL
start http://localhost:3000
call "%NPM_CLI%" start
pause
