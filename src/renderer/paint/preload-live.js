const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('live', {
  onCmd: (fn) => ipcRenderer.on('cmd', (_e, c, a) => fn(c, a)),
  text: (d) => ipcRenderer.send('live:text', d), down: () => ipcRenderer.send('live:down')
});
