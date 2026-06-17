@echo off
title 智学通 - Setup

echo.
echo ============================================
echo      ZhiXueTong - Setup
echo ============================================
echo.

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo.

echo [2/3] Installing frontend dependencies...
cd zhixuetong
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

echo [3/3] Installing backend dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ============================================
echo   Setup complete!
echo.
echo   Run: double-click run.bat
echo   URL: http://localhost:5173
echo   Demo: demo / demo123
echo ============================================
echo.
pause
