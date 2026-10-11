@echo off
setlocal
cd /d "%~dp0"
title VibraTok
color 0B
rem Configurar automaticamente el ID de cliente de Google
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$dir=Join-Path $env:APPDATA 'VibraTokData'; New-Item -ItemType Directory -Path $dir -Force | Out-Null; $cfg=@{clientId='188062078397-9ghnv0tgdtlfnuaik64pvb0mck1lk13t.apps.googleusercontent.com'} | ConvertTo-Json; Set-Content -LiteralPath (Join-Path $dir 'google-signin.json') -Value $cfg -Encoding UTF8" >nul 2>nul
echo ========================================
echo            VIBRATOK APP
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  echo Instala Node.js LTS una sola vez y vuelve a abrir VibraTok.
  pause
  exit /b 1
)
if not exist package.json (
  echo ERROR: No se encuentra package.json. Extrae todo el ZIP primero.
  pause
  exit /b 1
)
if not exist node_modules\express\package.json (
  call :install_deps
)
if not exist node_modules\google-auth-library\package.json (
  call :install_deps
)
goto :run_app

:install_deps

echo Instalando componentes necesarios. Se necesita Internet...
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo No se pudieron instalar los componentes. Comprueba Internet.
  pause
  exit /b 1
)
exit /b 0

:run_app
node launch.js
if errorlevel 1 (
  echo.
  echo VibraTok no pudo iniciar. Toma una foto de este mensaje.
  pause
)
