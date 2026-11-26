const { contextBridge, ipcRenderer } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
const on = (c) => (fn) => ipcRenderer.on(c, (_e, d) => fn(d));
contextBridge.exposeInMainWorld('trim', {
  onInfo: on('info'), onKeys: on('keys'), onReset: on('reset'), onProgress: on('progress'), onDone: on('done'),
  plan: inv('trim:plan'), export: inv('trim:export'), cancel: inv('trim:cancel'), reveal: inv('trim:reveal'), openResult: inv('trim:open-result'), close: inv('trim:close')
});
