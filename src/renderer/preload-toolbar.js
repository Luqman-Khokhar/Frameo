const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tb', {
  pause: () => ipcRenderer.send('toolbar:pause'), stop: () => ipcRenderer.send('toolbar:stop'),
  onTick: (fn) => ipcRenderer.on('tick', (_e, s) => fn(s)), onCount: (fn) => ipcRenderer.on('count', (_e, n) => fn(n))
});
