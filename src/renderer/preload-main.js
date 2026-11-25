const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('frameo', {
  state: inv('state'), saveSettings: inv('settings:save'), pickRegion: inv('region:pick'),
  shot: inv('shot'), recStart: inv('rec:start'), recPause: inv('rec:pause'), recResume: inv('rec:resume'), recStop: inv('rec:stop'),
  recents: inv('recents'), del: inv('item:delete'), reveal: inv('item:reveal'), open: inv('item:open'), copy: inv('item:copy'), annotate: inv('editor:open'),
  chooseDir: inv('dir:choose'), cmpPick: inv('compress:pick'), cmpProbe: inv('compress:probe'), cmpStart: inv('compress:start'), cmpCancel: inv('compress:cancel'),
  pathFor: (f) => webUtils.getPathForFile(f), minimize: inv('win:min'), close: inv('win:close'),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, ...a) => fn(...a))
});
