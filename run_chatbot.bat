@echo off
chcp 65001 > nul
echo ========================================================
echo   초중등 메타인지 & 인간-AI 성찰 챗봇 실행기
echo ========================================================
echo.

SET PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

REM 파이썬 인터프리터 경로 확인
IF EXIST "%PROJECT_DIR%..\py311\python.exe" (
    SET PYTHON_EXE=%PROJECT_DIR%..\py311\python.exe
) ELSE (
    SET PYTHON_EXE=python
)

echo [1/2] 가상환경 및 파이썬 확인: %PYTHON_EXE%
echo [2/2] Streamlit 챗봇 서버를 실행합니다...
echo.
echo 브라우저가 열릴 때까지 잠시만 기다려주세요 (http://localhost:8501)
echo ========================================================

"%PYTHON_EXE%" -m streamlit run app.py

pause
