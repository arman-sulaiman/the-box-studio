@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESTORE-BOX-STUDIO-WINDOWS.ps1"
set code=%errorlevel%
echo.
if not "%code%"=="0" echo Repair failed. See the message above.
pause
exit /b %code%
