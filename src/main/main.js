const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const DEV_MODE = false;

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
        menuBarVisible: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    if (DEV_MODE) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
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
    tray = new Tray(path.join(__dirname, '../../assets/c-_16px.png'));

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

function createSplash() {
    return new Promise((resolve) => {
        const { width, height } = screen.getPrimaryDisplay().bounds;
        const splashSize = 180;

        const splash = new BrowserWindow({
            width:           splashSize,
            height:          splashSize,
            x:               Math.floor((width - splashSize) / 2),
            y:               Math.floor((height - splashSize) / 2),
            frame:           false,
            transparent:     true,
            alwaysOnTop:     true,
            skipTaskbar:     true,
            resizable:       false,
            webPreferences:  { nodeIntegration: false }
        });

        splash.loadFile(path.join(__dirname, 'splash.html'));

        setTimeout(() => {
            splash.close();
            resolve();
        }, 2500);
    });
}

app.whenReady().then(async () => {
    app.setAppUserModelId('dev.cadence.app');
    await createSplash();
    createWindow();
    createTray();

    ipcMain.on('set-tray-icon', (event, state) => {
        const icons = {
            idle:  path.join(__dirname, '../../assets/c-_16px.png'),
            focus: path.join(__dirname, '../../assets/c-focus_16px.png'),
            break: path.join(__dirname, '../../assets/c-break_16px.png'),
        };
        const icon = icons[state] || icons.idle;
        tray.setImage(icon);
        mainWindow.setIcon(icon);
    });
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});