const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const { app, BrowserWindow } = require('electron');

let mainWindow;
let railsProcess;

// Wait for Rails server to be ready
function waitForRailsServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkServer = () => {
      const socket = new net.Socket();

      socket.on('connect', () => {
        socket.end();
        console.log('Rails server is ready');
        resolve();
      });

      socket.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Rails server failed to start'));
        } else {
          console.log(`Waiting for Rails server... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(checkServer, 1000);
        }
      });

      socket.connect(port, 'localhost');
    };

    checkServer();
  });
}

// Start Rails in development mode
async function startRailsServer() {
  const railsRoot = path.join(__dirname);

  // Start Rails server in development mode
  railsProcess = spawn('bundle', ['exec', 'rails', 'server'], {
    cwd: railsRoot,
    env: Object.assign({}, process.env, {
      RAILS_ENV: 'development',
      ACTION_CABLE_ADAPTER: 'async',
      ELECTRON_APP: 'true',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  railsProcess.stdout.on('data', (data) => {
    console.log(`Rails: ${data.toString().trim()}`);
  });

  railsProcess.stderr.on('data', (data) => {
    console.error(`Rails Error: ${data.toString().trim()}`);
  });

  await waitForRailsServer(3000);
}

// Create window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startRailsServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (railsProcess) {
    railsProcess.kill('SIGTERM');
  }
});
