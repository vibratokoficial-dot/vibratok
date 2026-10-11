@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VibraTok - Instalacion inicial
color 0B
echo =====================================================
echo       VIBRATOK - INSTALACION INICIAL
echo =====================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
if not exist package.json (
  echo ERROR: No se encontro package.json. Extrae todo el ZIP primero.
  pause
  exit /b 1
)
if not exist node_modules\express\package.json (
  call :INSTALL_DEPS
)
if not exist node_modules\google-auth-library\package.json (
  echo Instalando componentes necesarios; se necesita Internet...
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 goto ERROR
)
call CREAR_ACCESO_DIRECTO.bat
node launch.js
if errorlevel 1 goto ERROR
exit /b 0
:ERROR
echo.
echo VibraTok no pudo iniciar. Deja esta ventana abierta y envia una foto del error.
pause
exit /b 1
