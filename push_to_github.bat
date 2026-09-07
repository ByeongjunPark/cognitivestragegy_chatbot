@echo off
chcp 65001 > nul
echo ========================================================
echo   GitHub 자동 커밋 및 푸시 스크립트
echo   대상 리포지토리: https://github.com/ByeongjunPark/cognitivestragegy_chatbot
echo ========================================================
echo.

SET PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

REM Git 실행 파일 탐색
IF EXIST "%PROJECT_DIR%..\mingit\cmd\git.exe" (
    SET GIT_EXE=%PROJECT_DIR%..\mingit\cmd\git.exe
) ELSE (
    SET GIT_EXE=git
)

echo [1/4] Git 상태 확인...
"%GIT_EXE%" status

echo.
set /p COMMIT_MSG="커밋 메시지를 입력하세요 (엔터 시 기본 메시지 사용): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG="Update: 메타인지 챗봇 시스템 개선 (%date% %time%)"

echo.
echo [2/4] 변경 사항 스테이징 (git add)...
"%GIT_EXE%" add .

echo [3/4] 커밋 생성: %COMMIT_MSG%
"%GIT_EXE%" commit -m "%COMMIT_MSG%"

echo [4/4] GitHub 원격 저장소로 푸시 중 (git push)...
"%GIT_EXE%" push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   [성공] 코드가 GitHub에 성공적으로 푸시되었습니다!
    echo ========================================================
) else (
    echo.
    echo --------------------------------------------------------
    echo [안내] 푸시 실패 시 master 브랜치로 재시도합니다...
    "%GIT_EXE%" push -u origin master
    if %ERRORLEVEL% equ 0 (
        echo [성공] master 브랜치로 푸시 완료!
    ) else (
        echo [주의] GitHub 로그인 인증이나 권한을 확인해주세요.
    )
    echo --------------------------------------------------------
)

echo.
pause
