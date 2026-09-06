@echo off
chcp 65001 >nul
title SuperScan Dev Server
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ================================================================
echo           SuperScan - iOS Document Scanner Dev Server
echo ================================================================
echo.
echo [1/2] 清理佔用連接埠...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [2/2] 正在啟動 Expo 伺服器... 請保持這個視窗開啟！
echo.
echo ================================================================
call "C:\Program Files\nodejs\npx.cmd" expo start
echo.
echo ================================================================
echo 伺服器已結束。
pause
