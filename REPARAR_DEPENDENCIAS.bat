@echo off
setlocal
cd /d "%~dp0"
title Reparar componentes de VibraTok
color 0E
echo Reparando componentes de VibraTok (sin Electron)...
where node >nul 2>nul || (echo Node.js no esta instalado.& pause & exit /b 1)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (echo La reparacion fallo. Comprueba Internet y toma una foto del error.& pause & exit /b 1)
echo Reparacion terminada. Ahora abre INICIAR_VIBRATOK.bat.
pause
