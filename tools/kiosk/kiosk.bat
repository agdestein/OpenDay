@echo off
rem Double-click to run the arcade on this machine (see kiosk.mjs for options).
node "%~dp0kiosk.mjs" %*
if errorlevel 1 pause
