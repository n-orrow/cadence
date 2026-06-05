const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

const DEV_MODE = false;
const Store    = require('electron-store');
const store    = new Store();

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;
let tray;
let sidebarWindow    = null;
const SIDEBAR_WIDTH  = 280;
const TASKBAR_HEIGHT = 47;

// ─── WORK AREA ───────────────────────────────────────────────────────────────

function setWorkArea(left, right) {
    console.log(`Modifying work area boundaries -> Left: ${left}, Right: ${right}`);
    return new Promise((resolve) => {
        execFile('powershell', [
            '-ExecutionPolicy', 'Bypass',
            '-File', path.join(__dirname, 'workarea.ps1'),
            '-left', left,
            '-right', right
        ], (err, stdout, stderr) => {
            if (err)    console.error('WorkArea error:', err);
            if (stderr) console.error('WorkArea stderr:', stderr);
            if (stdout) console.log('WorkArea stdout:', stdout);
            resolve();
        });
    });
}

async function resetWorkArea() {
    const { width } = screen.getPrimaryDisplay().size;
    console.log('Resetting workspace horizontal boundaries to default fullscreen.');
    await setWorkArea(0, width);
}

// ─── WINDOWS ─────────────────────────────────────────────────────────────────

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().size;

    const windowWidth  = 400;
    const windowHeight = 500;

    const x = store.get('windowX', Math.floor((width - windowWidth) / 2));
    const y = store.get('windowY', Math.floor((height - windowHeight) / 2));

    mainWindow = new BrowserWindow({
        width:          windowWidth,
        height:         windowHeight,
        x,
        y,
        icon:           path.join(__dirname, '../../assets/c-_16px.png'),
        menuBarVisible: false,
        alwaysOnTop:    true,
        resizable:      false,
        skipTaskbar:    true,
        show:           false,
        webPreferences: {
            nodeIntegration:  true,
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
        if (!store.get('sidebarEnabled', false)) {
            mainWindow.show();
        }
    });

    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow.hide();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../../assets/c-_16px.png'));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Settings', click: () => {
                mainWindow.show();
                mainWindow.webContents.send('open-settings');
            }
        },
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
        const { width, height } = screen.getPrimaryDisplay().size;
        const splashSize = 180;

        const splash = new BrowserWindow({
            width:          splashSize,
            height:         splashSize,
            x:              Math.floor((width - splashSize) / 2),
            y:              Math.floor((height - splashSize) / 2),
            frame:          false,
            transparent:    true,
            alwaysOnTop:    true,
            skipTaskbar:    true,
            resizable:      false,
            webPreferences: { nodeIntegration: false }
        });

        splash.loadFile(path.join(__dirname, 'splash.html'));

        setTimeout(() => {
            splash.close();
            resolve();
        }, 2500);
    });
}

async function createSidebar(side = 'left') {
    console.log('createSidebar called:', side);

    if (sidebarWindow) {
        console.log('destroying existing sidebar');
        sidebarWindow.destroy();
        sidebarWindow = null;
    }

    const { width, height } = screen.getPrimaryDisplay().size;
    const sidebarX          = side === 'left' ? 0 : width - SIDEBAR_WIDTH;
    const sidebarHeight     = height - TASKBAR_HEIGHT;

    sidebarWindow = new BrowserWindow({
        width:          SIDEBAR_WIDTH,
        height:         sidebarHeight,
        x:              sidebarX,
        y:              0,
        frame:          false,
        transparent:    false,
        alwaysOnTop:    false,
        resizable:      false,
        roundedCorners: false,
        movable:        false,
        skipTaskbar:    true,
        show:           false,
        webPreferences: {
            nodeIntegration:  true,
            contextIsolation: false
        }
    });

    sidebarWindow.loadFile(path.join(__dirname, '../renderer/sidebar.html'));

    if (DEV_MODE) {
        sidebarWindow.webContents.openDevTools({ mode: 'detach' });
    }

    sidebarWindow.once('ready-to-show', async () => {
        if (!sidebarWindow) return;
        sidebarWindow.show();

        if (side === 'left') {
            await setWorkArea(SIDEBAR_WIDTH, width);
        } else {
            await setWorkArea(0, width - SIDEBAR_WIDTH);
        }
    });

    sidebarWindow.on('close', (e) => {
        e.preventDefault();
        if (sidebarWindow) sidebarWindow.hide();
    });
}

async function destroySidebar() {
    if (sidebarWindow) {
        sidebarWindow.destroy();
        sidebarWindow = null;
    }
    await resetWorkArea();
}

// ─── INIT ────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    await resetWorkArea();
    await new Promise(resolve => setTimeout(resolve, 500));

    app.setAppUserModelId('dev.cadence.app');
    await createSplash();
    createWindow();
    createTray();

    const sidebarEnabled = store.get('sidebarEnabled', false);
    const sidebarSide    = store.get('sidebarSide', 'left');

    if (sidebarEnabled) {
        if (mainWindow) mainWindow.hide();
        await createSidebar(sidebarSide);
    }

    ipcMain.on('set-tray-icon', (event, state) => {
        const icons = {
            idle:  path.join(__dirname, '../../assets/c-_16px.png'),
            focus: path.join(__dirname, '../../assets/c-focus_16px.png'),
            break: path.join(__dirname, '../../assets/c-break_16px.png'),
        };
        const icon = icons[state] || icons.idle;
        if (tray) tray.setImage(icon);
        if (mainWindow) mainWindow.setIcon(icon);
    });

    ipcMain.on('open-settings', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('open-settings');
        }
    });

    ipcMain.on('toggle-sidebar', async (event, { enabled, side }) => {
        if (enabled) {
            await createSidebar(side);
        } else {
            await destroySidebar();
            if (mainWindow) mainWindow.show();
        }
    });

    ipcMain.on('timer-state', (event, state) => {
        if (sidebarWindow && !sidebarWindow.isDestroyed()) {
            sidebarWindow.webContents.send('timer-state', state);
        }
    });

    ipcMain.on('sidebar-command', (event, command) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sidebar-command', command);
        }
    });
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});