@echo off
chcp 65001 > nul
title 도깨비의 세계 문파 분배 봇
echo ======================================================
echo   도깨비의 세계 문파 자동 분배 & 출석 집계 봇 실행기
echo ======================================================
echo.

if not exist ".env" (
    echo [!] .env 설정 파일이 없습니다.
    echo     .env.example 파일을 .env로 복사한 후 필요한 키들을 입력해주세요.
    pause
    exit /b
)

echo [*] 가상환경 활성화 및 봇 실행 중...
.\venv\Scripts\python.exe bot.py
pause
