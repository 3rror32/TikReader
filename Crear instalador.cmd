@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0packaging\build_installer.ps1"
set "result=%errorlevel%"
echo.
if not "%result%"=="0" echo No se pudo crear el instalador. Revisa el error de arriba.
pause
exit /b %result%
