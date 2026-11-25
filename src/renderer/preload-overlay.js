const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ov', {
  onInit: (fn) => ipcRenderer.on('init', (_e, d) => fn(d)), done: (res) => ipcRenderer.invoke('overlay:done', res)
});
