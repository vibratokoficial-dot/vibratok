const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');

// Evita abrir varias instancias de escritorio al hacer doble clic repetidamente.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let backend = null;
  let win = null;
  let activePort = null;
  let ownsBackend = false;

  function checkHealth(port, timeoutMs = 700) {
    return new Promise(resolve => {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: timeoutMs }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(res.statusCode === 200 && data.service === 'VibraTok');
          } catch { resolve(false); }
        });
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    });
  }

  function isPortFree(port) {
    return new Promise(resolve => {
      const tester = net.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => tester.close(() => resolve(true)));
      tester.listen(port, '127.0.0.1');
    });
  }

  async function choosePort() {
    // Si ya hay una instancia de VibraTok en el puerto estándar, reutilízala.
    if (await checkHealth(4317)) return { port: 4317, reuse: true };
    for (let port = 4317; port <= 4335; port++) {
      if (await isPortFree(port)) return { port, reuse: false };
    }
    throw new Error('No hay puertos libres entre 4317 y 4335. Cierra un servidor de VibraTok que esté duplicado e inténtalo de nuevo.');
  }

  function startBackend(port) {
    return new Promise((resolve, reject) => {
      const entry = path.join(__dirname, 'server.js');
      backend = spawn(process.execPath, [entry], {
        cwd: __dirname,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(port), HOST: '127.0.0.1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      ownsBackend = true;
      let output = '';
      let settled = false;
      const finishError = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => finishError(new Error('El servidor local no respondió a tiempo.\n' + output.slice(-2500))), 20000);
      const poll = setInterval(async () => {
        if (await checkHealth(port, 500)) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        }
      }, 350);
      backend.stdout.on('data', d => { output += d.toString(); });
      backend.stderr.on('data', d => { output += d.toString(); });
      backend.on('error', e => { clearInterval(poll); finishError(e); });
      backend.on('exit', code => {
        clearInterval(poll);
        if (!settled) finishError(new Error(`El servidor se cerró durante el arranque (código ${code}).\n${output.slice(-2500)}`));
      });
    });
  }

  function createWindow() {
    win = new BrowserWindow({
      width: 1440, height: 920, minWidth: 1040, minHeight: 700,
      backgroundColor: '#090910', title: 'VibraTok', autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    win.loadURL(`http://127.0.0.1:${activePort}`);
    win.on('closed', () => { win = null; });
  }

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const choice = await choosePort();
      activePort = choice.port;
      if (!choice.reuse) await startBackend(activePort);
      createWindow();
    } catch (e) {
      dialog.showErrorBox('VibraTok no pudo iniciar', e.message + '\n\nCierra las ventanas duplicadas y vuelve a abrir VibraTok. Si el problema continúa, ejecuta REPARAR_DEPENDENCIAS.bat.');
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && activePort) createWindow();
  });
  app.on('before-quit', () => {
    if (ownsBackend && backend && !backend.killed) backend.kill();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
