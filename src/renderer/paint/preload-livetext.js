const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lt', { done: (s) => ipcRenderer.send('livetext:done', String(s)), onCommit: (fn) => ipcRenderer.on('commit', () => fn()) });
