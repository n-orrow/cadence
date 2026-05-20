const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

const store = new Store();

let mainWindow;
let tray;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    const windowWidth = 400;
    const windowHeight = 500;

    const x = store.get('windowX', Math.floor((width - windowWidth) / 2));
    const y = store.get('windowY', Math.floor((height - windowHeight) / 2));

    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x,
        y,
        icon: path.join(__dirname, '../../assets/tray-icon.png'),
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.setAlwaysOnTop(true, 'screen-saver');

    mainWindow.on('moved', () => {
        const [x, y] = mainWindow.getPosition();
        store.set('windowX', x);
        store.set('windowY', y);
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow.hide();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Settings', click: () => console.log('settings') },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setToolTip('Cadence');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

app.whenReady().then(() => {
    app.setAppUserModelId('dev.cadence.app');
    createWindow();
    createTray();
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});