@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title TikReader Beta

set "RUNTIME_DIR=%~dp0runtime"
set "SOURCE_LAUNCHER=%RUNTIME_DIR%\source-launcher\TikReader\TikReader.exe"
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
set "STARTER_LOG_ROOT=%RUNTIME_DIR%\source-launcher-logs"
if not exist "%STARTER_LOG_ROOT%" mkdir "%STARTER_LOG_ROOT%" >nul 2>nul
if not exist "%STARTER_LOG_ROOT%\" goto StarterLogRootFailure
set "STARTER_LOG_DIR="
for /f "delims=" %%I in ('powershell.exe -NoProfile -NonInteractive -Command "[IO.Path]::GetRandomFileName()"') do set "STARTER_LOG_DIR=%STARTER_LOG_ROOT%\run-%%I"
if not defined STARTER_LOG_DIR goto StarterLogDirFailure
mkdir "!STARTER_LOG_DIR!" >nul 2>nul
if errorlevel 1 goto StarterLogDirFailure
set "LOGFILE=!STARTER_LOG_DIR!\launcher.log"
set "TIKREADER_STARTER_LOG=!LOGFILE!"
> "!LOGFILE!" echo [%date% %time%] TikReader source starter invocation

if not exist "app\launcher.py" (
  echo ERROR: No se encontro app\launcher.py en el espacio de trabajo.
  echo Verifica que la estructura de carpetas sea correcta.
  pause
  exit /b 1
)

set "PROBE_DIR="
set "PROBE_ATTEMPTS=0"
:CreateProbeDir
set /a PROBE_ATTEMPTS+=1
if !PROBE_ATTEMPTS! gtr 10 goto ProbeDirFailure
set "PROBE_DIR=%RUNTIME_DIR%\source-launch-probe-%RANDOM%-%RANDOM%-%RANDOM%"
if exist "!PROBE_DIR!" goto CreateProbeDir
mkdir "!PROBE_DIR!" >nul 2>nul
if errorlevel 1 goto CreateProbeDir
set "BACKEND_PATH_FILE=!PROBE_DIR!\backend-path.tmp"
set "BACKEND_CANDIDATES_FILE=!PROBE_DIR!\python-candidates.tmp"
set "SITE_PACKAGES_PATH_FILE=!PROBE_DIR!\site-packages.tmp"
set "PROBE_ERROR_FILE=!PROBE_DIR!\probe-errors.tmp"

if exist ".venv\Scripts\python.exe" (
  set "TIKREADER_SOURCE_BACKEND_PYTHON=%CD%\.venv\Scripts\python.exe"
  echo Usando el entorno virtual .venv...
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -c "import sys; print(sys.executable)" > "%BACKEND_PATH_FILE%" 2>> "%PROBE_ERROR_FILE%"
    if not errorlevel 1 set /p "TIKREADER_SOURCE_BACKEND_PYTHON=" < "%BACKEND_PATH_FILE%"
  )
  if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
    where python > "%BACKEND_CANDIDATES_FILE%" 2>nul
    if not errorlevel 1 (
      for /f "usebackq delims=" %%I in ("%BACKEND_CANDIDATES_FILE%") do (
        if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
          "%%I" -c "import sys; print(sys.executable)" > "%BACKEND_PATH_FILE%" 2>> "%PROBE_ERROR_FILE%"
          if not errorlevel 1 set /p "TIKREADER_SOURCE_BACKEND_PYTHON=" < "%BACKEND_PATH_FILE%"
        )
      )
    )
  )
  if not defined TIKREADER_SOURCE_BACKEND_PYTHON (
    if exist "!PROBE_ERROR_FILE!" type "!PROBE_ERROR_FILE!"
    call :CleanupProbeFiles
    echo ERROR: No se encontro Python para el backend. Crea .venv o instala Python.
    echo TikReader no se iniciara con un proceso de interfaz Python sin marca.
    pause
    exit /b 1
  )
  echo Usando Python del sistema para el backend...
)

"!TIKREADER_SOURCE_BACKEND_PYTHON!" -c "import os, site; print(next((path for path in site.getsitepackages() if os.path.basename(os.path.normpath(path)).casefold() == 'site-packages' and os.path.isdir(path)), ''))" > "%SITE_PACKAGES_PATH_FILE%" 2>> "%PROBE_ERROR_FILE%"
if errorlevel 1 (
  if exist "!PROBE_ERROR_FILE!" type "!PROBE_ERROR_FILE!"
  call :CleanupProbeFiles
  echo ERROR: No se pudo consultar el interprete seleccionado.
  pause
  exit /b 1
)
set /p "TIKREADER_SOURCE_BACKEND_SITE_PACKAGES=" < "%SITE_PACKAGES_PATH_FILE%"
call :CleanupProbeFiles
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

echo [%date% %time%] Verificando el lanzador de origen >> "!LOGFILE!"

"!TIKREADER_SOURCE_BACKEND_PYTHON!" "tools\build_source_launcher.py" >> "!LOGFILE!" 2>&1
if errorlevel 1 (
  type "!LOGFILE!"
  echo ERROR: No se pudo preparar el lanzador de TikReader.
  echo Revisa el registro: !LOGFILE!
  pause
  exit /b 1
)
if not exist "%SOURCE_LAUNCHER%" (
  echo ERROR: El lanzador de TikReader no fue generado.
  pause
  exit /b 1
)

echo [%date% %time%] Iniciando TikReader.exe >> "!LOGFILE!"
set "TIKREADER_SOURCE_LAUNCHER=%SOURCE_LAUNCHER%"
rem Retry only process metadata, for at most 19 sleeps of 50 ms; never wait for GUI exit.
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $stage='Invalid source launcher path'; try { if ([string]::IsNullOrWhiteSpace($env:TIKREADER_SOURCE_LAUNCHER)) { throw 'Configured path is empty' }; $exe=[IO.Path]::GetFullPath($env:TIKREADER_SOURCE_LAUNCHER); $stage='Launch failure'; $process=Start-Process -FilePath $exe -WorkingDirectory $env:TIKREADER_SOURCE_ROOT -PassThru -ErrorAction Stop; if ($null -eq $process) { throw 'Start-Process returned no process' }; $stage='Process image unavailable'; $image=$null; for ($attempt=0; $attempt -lt 20; $attempt++) { $exited=$false; try { $process.Refresh(); $exited=$process.HasExited } catch {}; if ($exited) { $stage='Process exited before image validation'; throw ('PID ' + $process.Id) }; try { $image=$process.Path } catch { $image=$null }; if (-not [string]::IsNullOrWhiteSpace($image)) { break }; if ($attempt -lt 19) { Start-Sleep -Milliseconds 50 } }; if ([string]::IsNullOrWhiteSpace($image)) { throw ('PID ' + $process.Id + ' after 20 metadata attempts') }; $stage='Unexpected process image'; $actual=[IO.Path]::GetFullPath($image); if ($actual -ne $exe) { throw ('Expected ' + $exe + ', received ' + $actual) }; $stage='Startup logging failure'; Add-Content -LiteralPath $env:TIKREADER_STARTER_LOG -Value ('Started TikReader.exe PID ' + $process.Id); exit 0 } catch { $message=$stage + ': ' + $_.Exception.Message; try { Add-Content -LiteralPath $env:TIKREADER_STARTER_LOG -Value $message } catch {}; Write-Error $message -ErrorAction Continue; exit 1 }"
if errorlevel 1 (
  set "EXITCODE=!errorlevel!"
  echo.
  echo ERROR: No se pudo iniciar TikReader.exe. Codigo !EXITCODE!.
  type "!LOGFILE!"
  echo Revisa el registro: !LOGFILE!
  pause
  exit /b !EXITCODE!
)
exit /b 0

:ProbeDirFailure
echo ERROR: No se pudo crear una carpeta temporal unica para consultar Python.
pause
exit /b 1

:CleanupProbeFiles
if defined PROBE_DIR if exist "!PROBE_DIR!" rmdir /s /q "!PROBE_DIR!" >nul 2>nul
set "PROBE_DIR="
exit /b 0

:StarterLogRootFailure
echo ERROR: No se pudo crear el directorio de registros de TikReader.
pause
exit /b 1

:StarterLogDirFailure
echo ERROR: No se pudo crear un registro unico para esta ejecucion de TikReader.
pause
exit /b 1
