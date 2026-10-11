@echo off
setlocal
cd /d "%~dp0"
set "TARGET=%~dp0INICIAR_VIBRATOK.bat"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $s=$ws.CreateShortcut((Join-Path $desktop 'VibraTok.lnk')); $s.TargetPath=$env:ComSpec; $s.Arguments='/c start `"VibraTok`" `"%TARGET%`"'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%SystemRoot%\System32\SHELL32.dll,220'; $s.Save()"
if errorlevel 1 (
 echo No se pudo crear el acceso directo automaticamente.
 pause
 exit /b 1
)
echo Se creo un acceso directo de VibraTok en el Escritorio.
echo Haz doble clic en el icono VibraTok para abrirlo.
pause
