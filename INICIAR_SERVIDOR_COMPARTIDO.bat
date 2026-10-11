@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Instala Node.js LTS primero.& pause & exit /b 1)
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (echo Error instalando dependencias.& pause & exit /b 1)
)
set HOST=0.0.0.0
set PORT=4317
node -e "const http=require('http');const r=http.get('http://127.0.0.1:4317/api/health',x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>{try{const j=JSON.parse(b);if(x.statusCode===200&&j.service==='VibraTok'){console.log('VibraTok ya esta funcionando en el puerto 4317. No hace falta abrir otro servidor.');process.exit(0)}else process.exit(2)}catch{process.exit(2)}})});r.setTimeout(900,()=>{r.destroy();process.exit(2)});r.on('error',()=>process.exit(2));" 
if not errorlevel 1 (pause & exit /b 0)
node -e "const net=require('net');(async()=>{for(let p=4317;p<=4335;p++){let ok=await new Promise(r=>{let s=net.createServer();s.once('error',()=>r(false));s.listen(p,'0.0.0.0',()=>s.close(()=>r(true)))});if(ok){console.log('Usando puerto disponible: '+p);process.stdout.write('PORT='+p);process.exit(0)}}process.exit(1)})()" > "%TEMP%\vibratok_port.txt"
if errorlevel 1 (echo No hay puertos libres entre 4317 y 4335. Cierra otros servidores y vuelve a intentar.& pause & exit /b 1)
for /f "tokens=1,2 delims==" %%A in (%TEMP%\vibratok_port.txt) do set %%A=%%B
echo VibraTok servidor compartido en http://127.0.0.1:%PORT%  (en otros equipos usa la IP de esta PC)
node server.js
pause
