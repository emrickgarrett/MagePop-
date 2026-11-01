// Bridge between the game (renderer) and native window features.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magepop', {
  desktop: true,
  platform: process.platform,
  quit: () => ipcRenderer.send('app:quit'),
  setFullscreen: (on) => ipcRenderer.send('window:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
});
