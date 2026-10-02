const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPlatform: () => process.platform,
  startHostServer: (port) => ipcRenderer.invoke('start-host-server', port),
  stopHostServer: () => ipcRenderer.invoke('stop-host-server'),
  getLocalIPs: () => ipcRenderer.invoke('get-local-ips'),
  startDiscovery: () => ipcRenderer.invoke('start-discovery'),
  onDiscoveredServer: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('server-discovered', listener);
    return () => ipcRenderer.removeListener('server-discovered', listener);
  },
  setAppRole: (role) => ipcRenderer.invoke('set-app-role', role),
  getAppRole: () => ipcRenderer.invoke('get-app-role'),

  // Auto-Update APIs
  getAppVersion: () => ipcRenderer.invoke('update:get-version'),
  checkForUpdate: (serverUrl) => ipcRenderer.invoke('update:check', serverUrl),
  downloadUpdate: (serverUrl) => ipcRenderer.invoke('update:download', serverUrl),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update:download-progress', listener);
    return () => ipcRenderer.removeListener('update:download-progress', listener);
  },
  openUpdatesFolder: () => ipcRenderer.invoke('update:open-folder'),
  publishUpdateFile: () => ipcRenderer.invoke('update:publish-file')
});
