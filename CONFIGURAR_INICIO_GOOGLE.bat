@echo off
chcp 65001 >nul
setlocal
title VibraTok - Configurar inicio con Google
color 0B
echo ================================================
echo   VIBRATOK - CONFIGURAR CONTINUAR CON GOOGLE
echo ================================================
echo.
echo Guardando el ID de cliente de Google...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $id='188062078397-9ghnv0tgdtlfnuaik64pvb0mck1lk13t.apps.googleusercontent.com'; $dir=Join-Path $env:APPDATA 'VibraTokData'; New-Item -ItemType Directory -Path $dir -Force | Out-Null; $cfg=@{clientId=$id} | ConvertTo-Json; Set-Content -LiteralPath (Join-Path $dir 'google-signin.json') -Value $cfg -Encoding UTF8; Write-Host ''; Write-Host 'ID de cliente guardado correctamente.' -ForegroundColor Green; Write-Host 'Ahora cierra VibraTok y vuelve a abrirlo.' -ForegroundColor Cyan; pause } catch { Write-Host ('ERROR: '+$_.Exception.Message) -ForegroundColor Red; pause; exit 1 }"
endlocal
