const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (o) => ipcRenderer.invoke(ch, o);

contextBridge.exposeInMainWorld('api', {
  versions: call('versions'),
  news: call('news'),
  featured: call('featured'),
  search: call('search'),
  install: call('install'),
  installPack: call('installPack'),
  scan: call('scan'),
  toggle: call('toggle'),
  remove: call('remove'),
  openFolder: call('openFolder'),
  deleteInstance: call('deleteInstance'),
  launch: call('launch'),
  authStatus: call('authStatus'),
  authLogin: call('authLogin'),
  authLogout: call('authLogout'),
  offlineProfileGet: call('offlineProfile:get'),
  offlineProfileSave: call('offlineProfile:save'),
  offlineProfileClear: call('offlineProfile:clear'),
  localGet: call('local:get'),
  localSave: call('local:save'),
  localClear: call('local:clear'),

  pickJava: call('pickJava'),
  javaCheck: call('javaCheck'),
  javaList: call('javaList'),
  javaInstall: call('javaInstall'),
  javaRemove: call('javaRemove'),
  storageInfo: call('storageInfo'),
  setPrefs: call('setPrefs'),
  about: call('about'),
  onGameClosed: (cb) => ipcRenderer.on('game:closed', (_e, d) => cb(d)),
  onLaunchProgress: (cb) => ipcRenderer.on('launch:progress', (_e, d) => cb(d)),
  onInfo: (cb) => ipcRenderer.on('info', (_e, m) => cb(m))
});
