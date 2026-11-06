@echo off
chcp 65001 > nul
title 외길 문파 디스코드 봇 실행기
echo ======================================================
echo   도깨비의 세계 [외길] 문파 디스코드 봇을 실행합니다.
echo ======================================================
echo.

cd /d "%~dp0"

if not exist ".env" (
    echo [!] .env 설정 파일이 없습니다.
    pause
    exit /b
)

echo [*] 봇을 가동하고 있습니다. 이 창을 닫지 마세요!
.\venv\Scripts\python.exe bot.py
pause
