const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

// Configurazione
const SERVER_PORT = 9002;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
let nodePath = null;
let npmPath = null;

// Trova Node.js su Windows
function findNodeOnWindows() {
    const possiblePaths = [
        // Installazione standard
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        // NVM for Windows
        path.join(process.env.APPDATA || '', 'nvm'),
        path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'nvm'),
        // Chocolatey
        'C:\\ProgramData\\chocolatey\\lib\\nodejs\\tools\\node',
        // Scoop
        path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'nodejs', 'current'),
        // fnm
        path.join(process.env.USERPROFILE || '', '.fnm', 'node-versions'),
        // Portable
        path.join(process.env.USERPROFILE || '', 'nodejs'),
    ];

    // Cerca nelle directory comuni
    for (const dir of possiblePaths) {
        if (fs.existsSync(dir)) {
            // Cerca node.exe direttamente
            const nodeExe = path.join(dir, 'node.exe');
            if (fs.existsSync(nodeExe)) {
                console.log(`Node trovato in: ${dir}`);
                return dir;
            }
            // Cerca nelle sottocartelle (per nvm)
            try {
                const subDirs = fs.readdirSync(dir);
                for (const subDir of subDirs) {
                    const subPath = path.join(dir, subDir);
                    const subNodeExe = path.join(subPath, 'node.exe');
                    if (fs.existsSync(subNodeExe)) {
                        console.log(`Node trovato in: ${subPath}`);
                        return subPath;
                    }
                }
            } catch (e) {
                // Ignora errori di lettura directory
            }
        }
    }

    // Prova a trovarlo nel PATH usando where
    try {
        const result = execSync('where node', { encoding: 'utf8', timeout: 5000 });
        const nodeBin = result.split('\n')[0].trim();
        if (nodeBin && fs.existsSync(nodeBin)) {
            const nodeDir = path.dirname(nodeBin);
            console.log(`Node trovato nel PATH: ${nodeDir}`);
            return nodeDir;
        }
    } catch (e) {
        console.log('Node non trovato con where');
    }

    return null;
}

// Configura l'ambiente per Windows
function setupWindowsEnvironment() {
    if (process.platform !== 'win32') return true;

    const nodeDir = findNodeOnWindows();
    if (!nodeDir) {
        console.error('Node.js non trovato su Windows');
        return false;
    }

    nodePath = path.join(nodeDir, 'node.exe');
    npmPath = path.join(nodeDir, 'npm.cmd');

    // Aggiungi al PATH
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(nodeDir)) {
        process.env.PATH = `${nodeDir};${currentPath}`;
        console.log(`PATH aggiornato con: ${nodeDir}`);
    }

    return true;
}

// Percorso all'app hub
function getHubAppPath() {
    if (isDev) {
        return path.join(__dirname, '..');
    }
    return path.join(process.resourcesPath, 'hub-app');
}

// Crea finestra splash
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
}

// Crea finestra principale
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'W[r]Digital Marketing HUB',
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Menu personalizzato
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                { label: 'Ricarica', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
                { type: 'separator' },
                { label: 'Esci', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }
            ]
        },
        {
            label: 'Modifica',
            submenu: [
                { label: 'Annulla', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Ripeti', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Taglia', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copia', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Incolla', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Seleziona tutto', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: 'Visualizza',
            submenu: [
                { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { label: 'Zoom Reset', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Schermo intero', accelerator: 'F11', role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
            ]
        },
        {
            label: 'Aiuto',
            submenu: [
                { label: 'Informazioni', click: () => showAboutDialog() }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    // Gestione link esterni
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http') && !url.includes('localhost')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Minimizza in tray invece di chiudere
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Mostra dialog "Informazioni"
function showAboutDialog() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'W[r]Digital Marketing HUB',
        message: 'W[r]Digital Marketing HUB',
        detail: `Versione: 1.0.0\n\nSistema centralizzato per la gestione di task, progetti, clienti e comunicazione.\n\n© 2024 W[r]Digital`,
        buttons: ['OK']
    });
}

// Crea icona nella system tray
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');

    if (!fs.existsSync(iconPath)) {
        console.log('Icona tray non trovata, skip creazione tray');
        return;
    }

    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Apri WRDigital HUB', click: () => { mainWindow.show(); mainWindow.focus(); } },
        { type: 'separator' },
        { label: 'Riavvia Server', click: () => restartServer() },
        { type: 'separator' },
        { label: 'Esci', click: () => { isQuitting = true; app.quit(); } }
    ]);

    tray.setToolTip('W[r]Digital Marketing HUB');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

// Controlla se il server è in esecuzione
function checkServerHealth() {
    return new Promise((resolve) => {
        const req = http.get(SERVER_URL, (res) => {
            resolve(res.statusCode === 200 || res.statusCode === 302);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Avvia il server Next.js
function startServer() {
    return new Promise((resolve, reject) => {
        const hubAppPath = getHubAppPath();

        // Su Windows usa il percorso npm trovato, altrimenti usa npm standard
        let npmCommand;
        if (process.platform === 'win32') {
            npmCommand = npmPath || 'npm.cmd';
        } else {
            npmCommand = 'npm';
        }

        console.log(`Avvio server da: ${hubAppPath}`);
        console.log(`Usando npm: ${npmCommand}`);

        // Controlla se node_modules esiste
        const nodeModulesPath = path.join(hubAppPath, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            console.log('node_modules non trovato, eseguo npm install...');
            const installProcess = spawn(npmCommand, ['install'], {
                cwd: hubAppPath,
                shell: true,
                stdio: 'inherit',
                env: process.env
            });

            installProcess.on('error', (err) => {
                console.error('Errore spawn npm install:', err);
                reject(new Error(`npm install fallito: ${err.message}`));
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    startServerProcess(hubAppPath, npmCommand, resolve, reject);
                } else {
                    reject(new Error(`npm install fallito con codice: ${code}`));
                }
            });
        } else {
            startServerProcess(hubAppPath, npmCommand, resolve, reject);
        }
    });
}

function startServerProcess(hubAppPath, npmCommand, resolve, reject) {
    serverProcess = spawn(npmCommand, ['run', 'dev'], {
        cwd: hubAppPath,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, BROWSER: 'none' }
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data}`);
        if (data.toString().includes('Ready') || data.toString().includes('started')) {
            resolve();
        }
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (error) => {
        console.error('Errore avvio server:', error);
        reject(error);
    });

    // Timeout per risoluzione
    setTimeout(() => resolve(), 15000);
}

// Riavvia il server
async function restartServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
    await startServer();
    if (mainWindow) {
        mainWindow.reload();
    }
}

// Ferma il server
function stopServer() {
    if (serverProcess) {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${serverProcess.pid} /T /F`);
        } else {
            serverProcess.kill('SIGTERM');
        }
        serverProcess = null;
    }
}

// Attendi che il server sia pronto
async function waitForServer(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const isReady = await checkServerHealth();
        if (isReady) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

// Inizializzazione app
app.whenReady().then(async () => {
    createSplashWindow();
    createMainWindow();
    createTray();

    try {
        // Configura ambiente Windows (cerca Node.js)
        if (process.platform === 'win32') {
            const nodeFound = setupWindowsEnvironment();
            if (!nodeFound) {
                dialog.showErrorBox(
                    'Node.js Non Trovato',
                    'Node.js non è stato trovato sul sistema.\n\n' +
                    'Per favore installa Node.js da:\nhttps://nodejs.org/\n\n' +
                    'Dopo l\'installazione, riavvia l\'applicazione.'
                );
                app.quit();
                return;
            }
        }
        // Controlla se il server è già in esecuzione
        const serverRunning = await checkServerHealth();

        if (!serverRunning) {
            console.log('Server non trovato, avvio...');
            await startServer();
            const ready = await waitForServer();

            if (!ready) {
                dialog.showErrorBox(
                    'Errore Avvio',
                    'Impossibile avviare il server. Verifica che Node.js sia installato e riprova.'
                );
                app.quit();
                return;
            }
        }

        // Carica l'app
        await mainWindow.loadURL(`${SERVER_URL}/dashboard`);

        // Chiudi splash e mostra finestra principale
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }

        mainWindow.show();
        mainWindow.focus();

    } catch (error) {
        console.error('Errore inizializzazione:', error);
        dialog.showErrorBox('Errore', `Impossibile avviare l'applicazione: ${error.message}`);
        app.quit();
    }
});

// Gestione chiusura
app.on('before-quit', () => {
    isQuitting = true;
});

app.on('will-quit', () => {
    stopServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    } else {
        mainWindow.show();
    }
});
