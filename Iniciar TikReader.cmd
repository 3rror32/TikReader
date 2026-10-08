@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title TikReader Beta

set "RUNTIME_DIR=%~dp0runtime"
set "SOURCE_LAUNCHER=%RUNTIME_DIR%\source-launcher\TikReader\TikReader.exe"
set "BACKEND_PATH_FILE=%RUNTIME_DIR%\source-backend-path.tmp"
set "BACKEND_CANDIDATES_FILE=%RUNTIME_DIR%\source-python-candidates.tmp"
set "SITE_PACKAGES_PATH_FILE=%RUNTIME_DIR%\source-site-packages.tmp"
set "LOGFILE=%RUNTIME_DIR%\launcher.log"
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"

if not exist "app\launcher.py" (
  echo ERROR: No se encontro app\launcher.py en el espacio de trabajo.
  echo Verifica que la estructura de carpetas sea correcta.
  pause
  exit /b 1
)

if exist ".venv\Scripts\python.exe" (
  set "TIKREADER_SOURCE_BACKEND_PYTHON=%CD%\.venv\Scripts\python.exe"
  echo Usando el entorno virtual .venv...
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -c "import sys; print(sys.executable)" > "%BACKEND_PATH_FILE%" 2>> "%LOGFILE%"
    if not errorlevel 1 set /p "TIKREADER_SOURCE_BACKEND_PYTHON=" < "%BACKEND_PATH_FILE%"
  )
  if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
    where python > "%BACKEND_CANDIDATES_FILE%" 2>nul
    if not errorlevel 1 (
      for /f "usebackq delims=" %%I in ("%BACKEND_CANDIDATES_FILE%") do (
        if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
          "%%I" -c "import sys; print(sys.executable)" > "%BACKEND_PATH_FILE%" 2>> "%LOGFILE%"
          if not errorlevel 1 set /p "TIKREADER_SOURCE_BACKEND_PYTHON=" < "%BACKEND_PATH_FILE%"
        )
      )
    )
  )
  if exist "%BACKEND_PATH_FILE%" del /q "%BACKEND_PATH_FILE%" >nul 2>nul
  if exist "%BACKEND_CANDIDATES_FILE%" del /q "%BACKEND_CANDIDATES_FILE%" >nul 2>nul
  if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
    echo ERROR: No se encontro Python para el backend. Crea .venv o instala Python.
    echo TikReader no se iniciara con un proceso de interfaz Python sin marca.
    pause
    exit /b 1
  )
  echo Usando Python del sistema para el backend...
)

"!TIKREADER_SOURCE_BACKEND_PYTHON!" -c "import os, site; print(next((path for path in site.getsitepackages() if os.path.basename(os.path.normpath(path)).casefold() == 'site-packages' and os.path.isdir(path)), ''))" > "%SITE_PACKAGES_PATH_FILE%" 2>> "%LOGFILE%"
if errorlevel 1 (
  if exist "%SITE_PACKAGES_PATH_FILE%" del /q "%SITE_PACKAGES_PATH_FILE%" >nul 2>nul
  echo ERROR: No se pudo consultar el interprete seleccionado.
  pause
  exit /b 1
)
set /p "TIKREADER_SOURCE_BACKEND_SITE_PACKAGES=" < "%SITE_PACKAGES_PATH_FILE%"
if exist "%SITE_PACKAGES_PATH_FILE%" del /q "%SITE_PACKAGES_PATH_FILE%" >nul 2>nul
if not defined TIKREADER_SOURCE_BACKEND_SITE_PACKAGES (
  echo ERROR: No se pudieron localizar los paquetes del interprete seleccionado.
  pause
  exit /b 1
)

set "TIKREADER_SOURCE_ROOT=%CD%"
set "PYTHONPYCACHEPREFIX=%RUNTIME_DIR%\pycache"
if /i "%~1"=="--probe-environment" (
  echo SOURCE_BACKEND_PYTHON=!TIKREADER_SOURCE_BACKEND_PYTHON!
  echo SOURCE_BACKEND_SITE_PACKAGES=!TIKREADER_SOURCE_BACKEND_SITE_PACKAGES!
  exit /b 0
)

echo [%date% %time%] Verificando el lanzador de origen >> "%LOGFILE%"

"!TIKREADER_SOURCE_BACKEND_PYTHON!" "tools\build_source_launcher.py"
if errorlevel 1 (
  echo ERROR: No se pudo preparar el lanzador de TikReader.
  echo Revisa el mensaje anterior y el registro: %LOGFILE%
  pause
  exit /b 1
)
if not exist "%SOURCE_LAUNCHER%" (
  echo ERROR: El lanzador de TikReader no fue generado.
  pause
  exit /b 1
)

echo [%date% %time%] Iniciando TikReader.exe >> "%LOGFILE%"
start "" /wait /b "%SOURCE_LAUNCHER%" 2>> "%LOGFILE%"
set "EXITCODE=!errorlevel!"
if not "!EXITCODE!"=="0" (
  echo.
  echo ERROR: La aplicacion termino con codigo !EXITCODE!.
  echo Revisa el registro: %LOGFILE%
  pause
)
exit /b !EXITCODE!
