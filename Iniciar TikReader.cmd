@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title TikReader Beta

set "PYTHONPYCACHEPREFIX=%~dp0runtime\pycache"
set "LAUNCHER=app\launcher.py"
set "LOGFILE=%~dp0runtime\launcher.log"

if not exist "runtime" mkdir "runtime"

echo [%date% %time%] Iniciando launcher >> "%LOGFILE%"

if not exist "%LAUNCHER%" (
  echo ERROR: No se encontro "%LAUNCHER%"
  echo Verifica que la estructura de carpetas sea correcta.
  echo [%date% %time%] ERROR: falta %LAUNCHER% >> "%LOGFILE%"
  pause
  exit /b 1
)

if exist ".venv\Scripts\python.exe" (
  echo Usando entorno virtual .venv...
  ".venv\Scripts\python.exe" "%LAUNCHER%" 2>> "%LOGFILE%"
  set "EXITCODE=!errorlevel!"
  if not "!EXITCODE!"=="0" (
    echo.
    echo ERROR: La aplicacion termino con codigo !EXITCODE!.
    echo Revisa el log: %LOGFILE%
    pause
  )
  exit /b !EXITCODE!
)

echo No se encontro .venv, buscando Python del sistema...
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: No se encontro Python instalado ^(ni "py" ni "python"^).
    echo Instala Python desde https://python.org o crea el entorno virtual .venv
    echo [%date% %time%] ERROR: Python no encontrado >> "%LOGFILE%"
    pause
    exit /b 1
  )
  echo Usando "python" del sistema ^(sin entorno virtual^)...
  python "%LAUNCHER%" 2>> "%LOGFILE%"
) else (
  echo Usando "py -3" del sistema ^(sin entorno virtual^)...
  py -3 "%LAUNCHER%" 2>> "%LOGFILE%"
)

set "EXITCODE=!errorlevel!"
if not "!EXITCODE!"=="0" (
  echo.
  echo ERROR: La aplicacion termino con codigo !EXITCODE!.
  echo Revisa el log: %LOGFILE%
  pause
)
exit /b !EXITCODE!
