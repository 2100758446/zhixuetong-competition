@echo off
title 智学通 - Setup

echo.
echo ============================================
echo      ZhiXueTong - Setup
echo ============================================
echo.

echo [1/3] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python 3.9+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

echo [2/3] Upgrading pip...
python -m pip install --upgrade pip -q
echo.

echo [3/3] Installing dependencies...
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo ============================================
echo   Setup complete!
echo.
echo   Run: double-click run.bat
echo   URL: http://localhost:5000
echo   Demo: demo / demo123
echo ============================================
echo.
pause
