const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function clientIndex() {
  // Packaged build: client is copied next to main.cjs. Dev checkout: use the workspace build.
  const packaged = path.join(__dirname, 'client', 'index.html');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', '..', 'packages', 'client', 'dist', 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0d0620',
    title: 'MagePop!',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.MAGEPOP_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(clientIndex());
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
}

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('window:setFullscreen', (e, on) => BrowserWindow.fromWebContents(e.sender)?.setFullScreen(!!on));
ipcMain.handle('window:isFullscreen', (e) => !!BrowserWindow.fromWebContents(e.sender)?.isFullScreen());

// Let the title music start without waiting for a click (it's a game, not a web page).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
