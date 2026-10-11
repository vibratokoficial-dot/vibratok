const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { exec } = require('node:child_process');

const HOST = '127.0.0.1';
const FIRST_PORT = 4317;
const LAST_PORT = 4335;
const root = __dirname;
let child;
let stopping = false;

function portFree(port) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, HOST, () => s.close(() => resolve(true)));
  });
}
async function choosePort() {
  // Reuse a running VibraTok server if one is already available.
  for (let p = FIRST_PORT; p <= LAST_PORT; p++) {
    try {
      const r = await fetch(`http://${HOST}:${p}/api/health`, { signal: AbortSignal.timeout(500) });
      if (r.ok) {
        const d = await r.json();
        if (d.service === 'VibraTok') {
          const cr = await fetch(`http://${HOST}:${p}/api/auth/google-config`, { signal: AbortSignal.timeout(500) });
          const gc = cr.ok ? await cr.json() : {};
          if (gc.clientId === '188062078397-9ghnv0tgdtlfnuaik64pvb0mck1lk13t.apps.googleusercontent.com') return { port: p, reuse: true };
        }
      }
    } catch {}
  }
  for (let p = FIRST_PORT; p <= LAST_PORT; p++) if (await portFree(p)) return { port: p, reuse: false };
  throw new Error(`No hay puertos libres entre ${FIRST_PORT} y ${LAST_PORT}. Cierra copias duplicadas de VibraTok.`);
}
function openAppWindow(url) {
  if (process.platform === 'win32') {
    // Launch Edge/Chrome in app mode: a standalone window without tabs or address bar.
    const ps = `
      $url='${url}';
      $candidates=@(
        "$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe",
        "$env:LOCALAPPDATA\\Microsoft\\Edge\\Application\\msedge.exe",
        "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
        "$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe",
        "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
      );
      $browser=$candidates | Where-Object { Test-Path $_ } | Select-Object -First 1;
      if ($browser) { Start-Process -FilePath $browser -ArgumentList @('--app='+$url, '--new-window'); exit 0 }
      $edge=(Get-Command msedge.exe -ErrorAction SilentlyContinue); if ($edge) { Start-Process msedge.exe -ArgumentList @('--app='+$url, '--new-window'); exit 0 }
      $chrome=(Get-Command chrome.exe -ErrorAction SilentlyContinue); if ($chrome) { Start-Process chrome.exe -ArgumentList @('--app='+$url, '--new-window'); exit 0 }
      Start-Process $url
    `.replace(/\r?\n/g, ' ');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '`"')}"`, err => {
      if (err) exec(`start "VibraTok" "${url}"`);
    });
  } else if (process.platform === 'darwin') exec(`open -a "Google Chrome" --args --app="${url}"`);
  else exec(`google-chrome --app="${url}" || xdg-open "${url}"`);
}
async function waitHealth(url) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(800) }); if (r.ok) return true; } catch {}
    await delay(300);
  }
  return false;
}
(async () => {
  const choice = await choosePort();
  const url = `http://${HOST}:${choice.port}`;
  console.log('Iniciando VibraTok como ventana de aplicación...');
  if (!choice.reuse) {
    child = spawn(process.execPath, [path.join(root, 'server.js')], {
      cwd: root,
      env: { ...process.env, PORT: String(choice.port), HOST },
      stdio: 'inherit',
      windowsHide: true
    });
    child.once('exit', code => { if (!stopping && code && code !== 0) console.error(`El servidor terminó con código ${code}.`); });
    if (!(await waitHealth(url))) throw new Error('VibraTok no respondió. Revisa si npm install terminó correctamente.');
  }
  console.log(`VibraTok está listo en ${url}`);
  console.log('Se abrirá en una ventana independiente de Edge o Chrome. Mantén esta ventana abierta mientras lo uses.');
  openAppWindow(url);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch(e => { console.error('\nNo se pudo abrir VibraTok: ' + e.message); process.exitCode = 1; });
function shutdown() { if (stopping) return; stopping = true; if (child && !child.killed) child.kill(); process.exit(); }
