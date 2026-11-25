const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ed', {
  onLoad: (fn) => ipcRenderer.on('load', (_e, d) => fn(d)),
  save: (buf) => ipcRenderer.invoke('editor:save', buf),
  copy: (buf) => ipcRenderer.invoke('editor:copy', buf)
});
