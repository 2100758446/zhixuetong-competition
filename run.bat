@echo off
title 智学通 - AI智能学习助手

echo.
echo ============================================
echo      ZhiXueTong - AI Campus Study Assistant
echo ============================================
echo.
echo [*] Starting server...
echo.
echo     Frontend: http://localhost:5173
echo     Backend:  http://localhost:3000
echo     Demo: demo / demo123
echo.
echo     Press Ctrl+C to stop
echo ============================================
echo.

cd zhixuetong
call npm run dev

pause
