const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();

let mainWindow
let tray

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.bounds

    const barWidth = 170
    const barHeight = 30

    mainWindow = new BrowserWindow({
        width: barWidth,
        height: barHeight,
        x: Math.floor((width - barWidth) / 2),
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        skipTaskbar: true,
        show: false,
        thickFrame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.on('blur', () => {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.showInactive();
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.setVisibleOnAllWorkspaces(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Cadence', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Settings', click: () => console.log('settings') },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Cadence');
    tray.setContextMenu(contextMenu);
}

app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(() => {
    app.setAppUserModelId('dev.cadence.app');
    createWindow();
    createTray();
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});