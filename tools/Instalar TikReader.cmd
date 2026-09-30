@echo off
cd /d "%~dp0.."
echo Se instalara un entorno Python local .venv y las dependencias fijadas.
echo Requiere Python instalado y conexion a Internet.
choice /C SN /M "Instalar ahora"
if errorlevel 2 exit /b 1
py -3 -m venv .venv
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"
if errorlevel 1 echo No se pudo crear el acceso directo. Puedes abrir Iniciar TikReader.cmd.
echo Instalacion terminada. Abre TikReader desde el escritorio o Iniciar TikReader.cmd.
pause
exit /b 0
:failed
echo No se completo la instalacion. Revisa el mensaje anterior.
pause
exit /b 1
