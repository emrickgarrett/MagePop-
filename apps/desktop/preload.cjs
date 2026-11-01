// Bridge between the game (renderer) and native window features.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magepop', {
  desktop: true,
  platform: process.platform,
  quit: () => ipcRenderer.send('app:quit'),
  setFullscreen: (on) => ipcRenderer.send('window:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  version: () => ipcRenderer.invoke('app:version'),
  update: {
    get: () => ipcRenderer.invoke('update:get'),
    onChange: (cb) => {
      const fn = (_e, state) => cb(state);
      ipcRenderer.on('update:state', fn);
      return () => ipcRenderer.removeListener('update:state', fn);
    },
    install: () => ipcRenderer.send('update:install'),
    openPage: () => ipcRenderer.send('update:openPage'),
  },
});
