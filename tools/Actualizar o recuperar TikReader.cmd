@echo off
cd /d "%~dp0.."
py -3 app\maintenance.py apply
pause
