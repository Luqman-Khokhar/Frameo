const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tb', {
  pause: () => ipcRenderer.send('toolbar:pause'), stop: () => ipcRenderer.send('toolbar:stop'), move: (x, y) => ipcRenderer.send('toolbar:move', x, y),
  ink: () => ipcRenderer.send('paint:toggle'), paint: (c, a) => ipcRenderer.send('paint:cmd', c, a), onPaint: (fn) => ipcRenderer.on('paint', (_e, s) => fn(s)),
  onTick: (fn) => ipcRenderer.on('tick', (_e, s) => fn(s)), onCount: (fn) => ipcRenderer.on('count', (_e, n) => fn(n))
});
