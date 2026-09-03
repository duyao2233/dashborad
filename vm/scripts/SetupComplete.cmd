@echo off
REM Runs at end of Windows setup via $OEM$ folder
mkdir C:\setup 2>nul
copy /Y D:\setup\post-install.ps1 C:\setup\ 2>nul
copy /Y E:\setup\post-install.ps1 C:\setup\ 2>nul
copy /Y F:\setup\post-install.ps1 C:\setup\ 2>nul
powershell -ExecutionPolicy Bypass -File C:\setup\post-install.ps1 >> C:\setup\setup-complete.log 2>&1
