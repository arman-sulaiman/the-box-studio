@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env
call npm ci
if errorlevel 1 goto failed
call npm run browser:install
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
echo Setup finished. Save your temporary admin password. Then run START-WINDOWS.bat.
pause
exit /b 0
:failed
echo Setup did not finish. See the error above and SETUP.md.
pause
exit /b 1
