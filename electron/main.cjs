const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const lan = require('../server/lanDiscovery.cjs');
let serverModule = null;

let mainWindow = null;
let isServerRunning = false;

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
      contextIsolation: true
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
  const dir = path.join(app.getPath('temp'), 'ChauCaoJudge_Update');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Check for update from the server (supports both http and https, follows redirects)
async function checkForUpdate(serverUrl) {
  const currentVersion = getAppVersion();
  const initialUrl = `${serverUrl}/api/update/check?version=${currentVersion}`;

  return new Promise((resolve, reject) => {
    function makeRequest(targetUrl, redirectCount = 0) {
      if (redirectCount > 5) {
        return reject(new Error('Quá nhiều lần chuyển hướng'));
      }
      const client = targetUrl.startsWith('https:') ? https : http;
      const req = client.get(targetUrl, { timeout: 10000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          return makeRequest(redirectUrl, redirectCount + 1);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            reject(new Error('Phản hồi không hợp lệ từ máy chủ'));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Hết thời gian chờ'));
      });
    }

    makeRequest(initialUrl);
  });
}

// Download update file with progress (supports both http and https, follows redirects)
function downloadUpdate(serverUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const initialUrl = `${serverUrl}/api/update/download`;

    function makeDownload(targetUrl, redirectCount = 0) {
      if (redirectCount > 5) {
        return reject(new Error('Quá nhiều lần chuyển hướng khi tải file'));
      }
      const client = targetUrl.startsWith('https:') ? https : http;
      const req = client.get(targetUrl, { timeout: 600000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          return makeDownload(redirectUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Lỗi tải file: HTTP ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        const updateVersion = res.headers['x-update-version'] || 'unknown';
        let downloadedSize = 0;

        const file = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0 && onProgress) {
            onProgress({
              percent: Math.round((downloadedSize / totalSize) * 100),
              downloadedMB: (downloadedSize / (1024 * 1024)).toFixed(1),
              totalMB: (totalSize / (1024 * 1024)).toFixed(1),
              version: updateVersion
            });
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            resolve({ filePath: destPath, version: updateVersion, size: downloadedSize });
          });
        });

        file.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Hết thời gian tải file'));
      });
    }

    makeDownload(initialUrl);
  });
}

// Install update (run the NSIS installer silently, relaunch app, and quit)
function installUpdate(installerPath) {
  const currentExe = process.execPath;
  const tempDir = getUpdateTempDir();
  const scriptPath = path.join(tempDir, 'run_update.bat');

  // NSIS /S silent install script that restarts the newly installed app
  const batchScript = `@echo off
chcp 65001 >nul
echo [ChauCaoJudge Update] Waiting for old process to exit...
timeout /t 2 /nobreak >nul
echo [ChauCaoJudge Update] Installing update silently...
start /wait "" "${installerPath}" /S
echo [ChauCaoJudge Update] Launching updated application...
timeout /t 1 /nobreak >nul
start "" "${currentExe}"
exit
`;

  try {
    fs.writeFileSync(scriptPath, batchScript, 'utf8');
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    setTimeout(() => {
      app.quit();
    }, 500);
  } catch (err) {
    console.error('Failed to run update batch script, falling back to direct installer spawn:', err);
    const child = spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}


// IPC Handlers
ipcMain.handle('get-local-ips', async () => {
  return lan.getLocalIPs();
});

ipcMain.handle('get-app-role', async () => {
  return getSavedRole();
});

ipcMain.handle('set-app-role', async (event, role) => {
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

ipcMain.handle('stop-host-server', async () => {
  if (serverModule && serverModule.server) {
    serverModule.server.close();
    lan.stopHostBeacon();
    isServerRunning = false;
  }
  return { success: true };
});

ipcMain.handle('start-discovery', async () => {
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

ipcMain.handle('update:get-version', async () => {
  return getAppVersion();
});

ipcMain.handle('update:check', async (event, serverUrl) => {
  try {
    const result = await checkForUpdate(serverUrl);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:download', async (event, serverUrl) => {
  try {
    const tempDir = getUpdateTempDir();
    const destPath = path.join(tempDir, 'ChauCaoJudge_Update.exe');

    // Clean up previous download if exists
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }

    const result = await downloadUpdate(serverUrl, destPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:download-progress', progress);
      }
    });

    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File cài đặt không tồn tại trên hệ thống.' };
    }
    installUpdate(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:open-folder', async () => {
  try {
    const appDataDir = process.env.APPDATA || process.env.HOME || process.cwd();
    const dir = path.join(appDataDir, 'ChauCaoJudge LAN', 'updates');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:publish-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn file cài đặt mới (.exe) để phát hành qua mạng LAN',
      filters: [
        { name: 'Bộ cài đặt ChauCaoJudge LAN (*.exe)', extensions: ['exe'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const appDataDir = process.env.APPDATA || process.env.HOME || process.cwd();
    const targetDir = path.join(appDataDir, 'ChauCaoJudge LAN', 'updates');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, fileName);
    fs.copyFileSync(sourcePath, targetPath);

    const stat = fs.statSync(targetPath);
    const versionMatch = fileName.match(/(\d+\.\d+\.\d+)/);

    return {
      success: true,
      fileName,
      sizeMB: (stat.size / (1024 * 1024)).toFixed(1),
      version: versionMatch ? versionMatch[1] : null,
      targetPath
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
