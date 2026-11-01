const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
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

// ---- Auto-update ------------------------------------------------------------
// Checks the GitHub Releases page for a newer *published* version (drafts are invisible to players).
// Windows installer + Linux AppImage download in the background and install on restart.
// macOS (unsigned builds can't self-update) and the Windows portable exe just get a "download" link.
const RELEASES_URL = 'https://github.com/emrickgarrett/MagePop-/releases/latest';
let updateState = { status: 'idle' };
const canSelfUpdate = process.platform !== 'darwin' && !process.env.PORTABLE_EXECUTABLE_DIR;

function sendUpdate(state) {
  updateState = state;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:state', state);
}

function startUpdater() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.error('electron-updater unavailable', err);
    return;
  }
  autoUpdater.autoDownload = canSelfUpdate;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) =>
    sendUpdate({ status: canSelfUpdate ? 'downloading' : 'available', version: info.version, percent: 0 }),
  );
  autoUpdater.on('download-progress', (p) =>
    sendUpdate({ ...updateState, status: 'downloading', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ status: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => console.error('update check failed', err?.message ?? err)); // offline etc: stay quiet
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 60 * 60 * 1000); // and hourly for long sessions

  ipcMain.on('update:install', () => {
    if (updateState.status === 'ready') autoUpdater.quitAndInstall();
  });
}

// Released builds get their version from the git tag (see .github/workflows/release.yml).
// Local runs say "-dev" so they can't be mistaken for a release.
ipcMain.handle('app:version', () => (app.isPackaged ? app.getVersion() : `${app.getVersion()}-dev`));
ipcMain.handle('update:get', () => updateState);
ipcMain.on('update:openPage', () => shell.openExternal(RELEASES_URL));
ipcMain.on('window:setFullscreen', (e, on) => BrowserWindow.fromWebContents(e.sender)?.setFullScreen(!!on));
ipcMain.handle('window:isFullscreen', (e) => !!BrowserWindow.fromWebContents(e.sender)?.isFullScreen());

// Let the title music start without waiting for a click (it's a game, not a web page).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  createWindow();
  startUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
