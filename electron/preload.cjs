const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPlatform: () => process.platform,
  startHostServer: (port) => ipcRenderer.invoke('start-host-server', port),
  stopHostServer: () => ipcRenderer.invoke('stop-host-server'),
  getLocalIPs: () => ipcRenderer.invoke('get-local-ips'),
  startDiscovery: () => ipcRenderer.invoke('start-discovery'),
  onDiscoveredServer: (callback) => {
    ipcRenderer.on('server-discovered', (event, data) => callback(data));
  },
  setAppRole: (role) => ipcRenderer.invoke('set-app-role', role),
  getAppRole: () => ipcRenderer.invoke('get-app-role'),

  // Auto-Update APIs
  getAppVersion: () => ipcRenderer.invoke('update:get-version'),
  checkForUpdate: (serverUrl) => ipcRenderer.invoke('update:check', serverUrl),
  downloadUpdate: (serverUrl) => ipcRenderer.invoke('update:download', serverUrl),
  installUpdate: (filePath) => ipcRenderer.invoke('update:install', filePath),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:download-progress', (event, data) => callback(data));
  },
  openUpdatesFolder: () => ipcRenderer.invoke('update:open-folder'),
  publishUpdateFile: () => ipcRenderer.invoke('update:publish-file')
});
