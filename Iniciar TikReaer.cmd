@echo off
rem Compatibilidad con accesos directos creados antes de unificar el nombre.
call "%~dp0Iniciar TikReader.cmd" %*
exit /b %errorlevel%
