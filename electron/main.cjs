const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const lan = require('../server/lanDiscovery.cjs');
const {
  MAX_UPDATE_BYTES,
  VerifiedUpdateState,
  compareVersions,
  isTrustedRendererUrl,
  validateLanServerUrl,
  verifyUpdateArtifact,
  verifyUpdateManifest
} = require('../server/updateSecurity.cjs');
let serverModule = null;

let mainWindow = null;
let isServerRunning = false;
let checkedUpdate = null;
const verifiedUpdateState = new VerifiedUpdateState();
const updatePublicKey = fs.readFileSync(path.join(__dirname, '..', 'config', 'update-public-key.pem'), 'utf8');
const packagedEntryUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;

// Read app version from package.json
function getAppVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "ChauCaoJudge - C++ Online Judge Trường Học",
    backgroundColor: '#0c0f17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    const loadDev = () => {
      mainWindow.loadURL(devUrl).catch(() => {
        setTimeout(loadDev, 1000);
      });
    };
    loadDev();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedRendererUrl(targetUrl, { packaged: app.isPackaged, packagedEntryUrl })) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function isTrustedIpcEvent(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  return isTrustedRendererUrl(senderUrl, { packaged: app.isPackaged, packagedEntryUrl });
}

function rejectUntrustedIpc(event) {
  return !isTrustedIpcEvent(event)
    ? { success: false, error: 'Nguồn IPC không được tin cậy.' }
    : null;
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'app_config.json');
}

function getSavedRole() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      return cfg.role || null;
    }
  } catch (e) {}
  return null;
}

function saveAppRole(role) {
  try {
    const p = getConfigPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ role }, null, 2), 'utf8');
  } catch (e) {}
}

// ========================================
// AUTO-UPDATE SYSTEM
// ========================================

// Get the download temp dir
function getUpdateTempDir() {
  const dir = path.join(app.getPath('temp'), 'SchoolJudge_Update');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Check for update from the server
async function checkForUpdate(serverUrl) {
  const currentVersion = getAppVersion();
  const trustedServerUrl = validateLanServerUrl(serverUrl);
  const url = `${trustedServerUrl}/api/update/check?version=${currentVersion}`;

  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 64 * 1024) req.destroy(new Error('Phản hồi manifest quá lớn.'));
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode !== 200) throw new Error(result.error || `HTTP ${res.statusCode}`);
          if (result.updateAvailable) {
            verifyUpdateManifest(result.manifest, updatePublicKey);
            if (compareVersions(result.manifest.version, currentVersion) <= 0) {
              throw new Error('Manifest không chứa phiên bản mới hơn.');
            }
            checkedUpdate = { serverUrl: trustedServerUrl, manifest: result.manifest };
          } else {
            checkedUpdate = null;
            verifiedUpdateState.clear();
          }
          resolve(result);
        } catch (e) {
          reject(new Error(`Phản hồi cập nhật không hợp lệ: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Hết thời gian chờ'));
    });
  });
}

// Download update file with progress
function downloadUpdate(serverUrl, manifest, destPath, onProgress) {
  const trustedServerUrl = validateLanServerUrl(serverUrl);
  verifyUpdateManifest(manifest, updatePublicKey);
  if (!checkedUpdate || checkedUpdate.serverUrl !== trustedServerUrl || checkedUpdate.manifest.signature !== manifest.signature) {
    return Promise.reject(new Error('Bản cập nhật chưa được kiểm tra trong phiên hiện tại.'));
  }
  if (path.basename(destPath) !== manifest.fileName) {
    return Promise.reject(new Error('Đường dẫn tải không khớp manifest.'));
  }

  return new Promise((resolve, reject) => {
    const url = `${trustedServerUrl}/api/update/download`;
    const partialPath = `${destPath}.part`;
    try { if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath); } catch {}
    const file = fs.createWriteStream(partialPath, { flags: 'wx' });
    const hash = crypto.createHash('sha256');
    let downloadedSize = 0;
    let settled = false;

    const failDownload = error => {
      if (settled) return;
      settled = true;
      try { file.destroy(); } catch {}
      try { if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath); } catch {}
      reject(error);
    };

    const req = http.get(url, { timeout: 300000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        failDownload(new Error(`Lỗi tải file: HTTP ${res.statusCode}`));
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10) || 0;
      if (totalSize !== manifest.size || totalSize <= 0 || totalSize > MAX_UPDATE_BYTES) {
        res.destroy();
        failDownload(new Error('Content-Length không khớp manifest.'));
        return;
      }

      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (downloadedSize > manifest.size || downloadedSize > MAX_UPDATE_BYTES) {
          res.destroy();
          failDownload(new Error('File tải xuống vượt quá dung lượng manifest.'));
          return;
        }
        hash.update(chunk);
        file.write(chunk);
        if (onProgress) {
          onProgress({
            percent: Math.round((downloadedSize / totalSize) * 100),
            downloadedMB: (downloadedSize / (1024 * 1024)).toFixed(1),
            totalMB: (totalSize / (1024 * 1024)).toFixed(1),
            version: manifest.version
          });
        }
      });
      res.on('end', () => file.end());
      res.on('error', failDownload);

      file.on('finish', () => {
        if (settled) return;
        try {
          if (downloadedSize !== manifest.size || hash.digest('hex') !== manifest.sha256) {
            throw new Error('SHA-256 hoặc dung lượng file tải xuống không khớp manifest.');
          }
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          fs.renameSync(partialPath, destPath);
          verifyUpdateArtifact({ manifest, publicKey: updatePublicKey, installerPath: destPath, currentVersion: getAppVersion() });
          verifiedUpdateState.markVerified(destPath, manifest);
          settled = true;
          resolve({ version: manifest.version, size: downloadedSize, verified: true });
        } catch (error) {
          failDownload(error);
        }
      });
      file.on('error', failDownload);
    });

    req.on('error', failDownload);
    req.on('timeout', () => {
      req.destroy(new Error('Hết thời gian tải file'));
    });
  });
}

// Install update (run the NSIS installer silently, relaunch app, and quit)
function installUpdate(installerPath) {
  if (process.platform !== 'win32') throw new Error('Cài đặt tự động chỉ hỗ trợ Windows.');
  const child = spawn(installerPath, ['/S'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false
  });
  child.unref();
  setTimeout(() => app.quit(), 500);
}


// IPC Handlers
ipcMain.handle('get-local-ips', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  return lan.getLocalIPs();
});

ipcMain.handle('get-app-role', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return null;
  return getSavedRole();
});

ipcMain.handle('set-app-role', async (event, role) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  if (role !== 'host' && role !== 'student') {
    return { success: false, error: 'Vai trò thiết bị không hợp lệ.' };
  }
  saveAppRole(role);
  if (role === 'host' && !isServerRunning) {
    try {
      serverModule = require('../server/index.cjs');
      serverModule.startServer(4000);
      isServerRunning = true;
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else if (role === 'student' && isServerRunning) {
    if (serverModule && serverModule.server) {
      serverModule.server.close();
      lan.stopHostBeacon();
      isServerRunning = false;
    }
  }
  return { success: true, role };
});

ipcMain.handle('start-host-server', async (event, port = 4000) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  if (!Number.isInteger(port) || port !== 4000) {
    return { success: false, error: 'Chỉ hỗ trợ cổng máy chủ 4000.' };
  }
  if (isServerRunning) return { success: true, message: 'Server already running' };
  try {
    serverModule = require('../server/index.cjs');
    serverModule.startServer(port);
    isServerRunning = true;
    return { success: true, port };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-host-server', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  if (serverModule && serverModule.server) {
    serverModule.server.close();
    lan.stopHostBeacon();
    isServerRunning = false;
  }
  return { success: true };
});

ipcMain.handle('start-discovery', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  lan.startDiscoveryListener((serverInfo) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-discovered', serverInfo);
    }
  });
  return { listening: true };
});

// ========================================
// AUTO-UPDATE IPC Handlers
// ========================================

ipcMain.handle('update:get-version', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return '';
  return getAppVersion();
});

ipcMain.handle('update:check', async (event, serverUrl) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  try {
    verifiedUpdateState.clear();
    checkedUpdate = null;
    const result = await checkForUpdate(serverUrl);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:download', async (event, serverUrl) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  try {
    const trustedServerUrl = validateLanServerUrl(serverUrl);
    if (!checkedUpdate || checkedUpdate.serverUrl !== trustedServerUrl) {
      return { success: false, error: 'Hãy kiểm tra bản cập nhật trước khi tải.' };
    }
    const tempDir = getUpdateTempDir();
    const destPath = path.join(tempDir, checkedUpdate.manifest.fileName);

    // Clean up previous download if exists
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }

    const result = await downloadUpdate(trustedServerUrl, checkedUpdate.manifest, destPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:download-progress', progress);
      }
    });

    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  try {
    const verified = verifiedUpdateState.consume();
    verifyUpdateArtifact({
      manifest: verified.manifest,
      publicKey: updatePublicKey,
      installerPath: verified.installerPath,
      currentVersion: getAppVersion()
    });
    installUpdate(verified.installerPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:open-folder', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  if (getSavedRole() !== 'host') return { success: false, error: 'Chỉ máy Host được mở thư mục cập nhật.' };
  try {
    const appDataDir = process.env.APPDATA || process.env.HOME || process.cwd();
    const dir = path.join(appDataDir, 'SchoolJudge LAN', 'updates');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:publish-file', async (event) => {
  const rejection = rejectUntrustedIpc(event);
  if (rejection) return rejection;
  if (getSavedRole() !== 'host') return { success: false, error: 'Chỉ máy Host được phát hành cập nhật.' };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn installer .exe và update-manifest.json đã ký',
      filters: [
        { name: 'Gói cập nhật đã ký', extensions: ['exe', 'json'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const installerSource = result.filePaths.find(file => path.extname(file).toLowerCase() === '.exe');
    const manifestSource = result.filePaths.find(file => path.extname(file).toLowerCase() === '.json');
    if (!installerSource || !manifestSource) {
      return { success: false, error: 'Phải chọn đúng một installer .exe và một manifest .json.' };
    }
    const manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'));
    verifyUpdateArtifact({
      manifest,
      publicKey: updatePublicKey,
      installerPath: installerSource,
      currentVersion: '0.0.0'
    });

    const appDataDir = process.env.APPDATA || process.env.HOME || process.cwd();
    const targetDir = path.join(appDataDir, 'SchoolJudge LAN', 'updates');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, manifest.fileName);
    const installerTempPath = `${targetPath}.tmp`;
    const manifestPath = path.join(targetDir, 'update-manifest.json');
    const manifestTempPath = `${manifestPath}.tmp`;
    fs.copyFileSync(installerSource, installerTempPath);
    fs.writeFileSync(manifestTempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.renameSync(installerTempPath, targetPath);
    fs.renameSync(manifestTempPath, manifestPath);
    verifyUpdateArtifact({ manifest, publicKey: updatePublicKey, installerPath: targetPath, currentVersion: '0.0.0' });

    return {
      success: true,
      fileName: manifest.fileName,
      sizeMB: (manifest.size / (1024 * 1024)).toFixed(1),
      version: manifest.version,
      signed: true
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ========================================
// APP LIFECYCLE
// ========================================

app.whenReady().then(() => {
  // Chỉ tự động khởi động máy chủ nếu máy tính này được chỉ định làm Máy Chủ (Host)
  const role = getSavedRole();
  const isHost = role === 'host' || process.argv.includes('--host');

  if (isHost) {
    try {
      serverModule = require('../server/index.cjs');
      serverModule.startServer(process.env.PORT || 4000);
      isServerRunning = true;
    } catch (err) {
      console.error('Could not auto-start local server:', err);
    }
  }

  // Content-Security-Policy — defense-in-depth against XSS
  const isDev = !app.isPackaged;
  const cspPolicy = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' http://localhost:5173 http://127.0.0.1:5173"
      : "script-src 'self'",
    isDev
      ? "style-src 'self' 'unsafe-inline' http://localhost:5173 http://127.0.0.1:5173 https://fonts.googleapis.com"
      : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "connect-src 'self' http: https: ws: wss:",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  lan.stopHostBeacon();
  lan.stopDiscoveryListener();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
