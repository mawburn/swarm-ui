const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const { app, BrowserWindow, dialog } = require('electron');

let mainWindow;
let railsProcess;
let ttydProcess;
let railsPort = 3000;
let ttydPort = 8999;

// Find an available port
function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      if (startPort < 65535) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error('No available ports'));
      }
    });
  });
}

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

// Check if Ruby is available
function checkRubyInstallation() {
  try {
    const rubyVersion = execSync('ruby --version', { encoding: 'utf8' });
    console.log('Ruby found:', rubyVersion.trim());
    return true;
  } catch (error) {
    return false;
  }
}

// Check if bundler is available
function checkBundlerInstallation() {
  try {
    const bundlerVersion = execSync('bundle --version', { encoding: 'utf8' });
    console.log('Bundler found:', bundlerVersion.trim());
    return true;
  } catch (error) {
    return false;
  }
}

// Run database migrations
function runDatabaseMigrations() {
  try {
    console.log('Running database migrations...');
    const railsRoot = path.join(__dirname, '..');

    // Run db:prepare to create and migrate database
    // First install solid_queue if needed
    try {
      execSync('bundle exec rails solid_queue:install', {
        cwd: railsRoot,
        env: Object.assign({}, process.env, {
          RAILS_ENV: 'development',
          ACTION_CABLE_ADAPTER: 'async',
          ELECTRON_APP: 'true',
          SECRET_KEY_BASE:
            process.env.SECRET_KEY_BASE || 'development-secret-key-base-for-electron-app-only',
        }),
        encoding: 'utf8',
      });
    } catch (e) {
      // Ignore if already installed
    }

    execSync('bundle exec rails db:prepare', {
      cwd: railsRoot,
      env: Object.assign({}, process.env, {
        RAILS_ENV: 'development',
        ACTION_CABLE_ADAPTER: 'async',
        ELECTRON_APP: 'true',
        SECRET_KEY_BASE:
          process.env.SECRET_KEY_BASE || 'development-secret-key-base-for-electron-app-only',
      }),
      encoding: 'utf8',
    });

    console.log('Database migrations completed');

    // Skip asset precompilation in development mode
    console.log('Skipping asset precompilation in development mode');

    return true;
  } catch (error) {
    console.error('Failed to run database migrations:', error);
    return false;
  }
}

// Start Rails server
async function startRailsServer() {
  try {
    // Check dependencies
    if (!checkRubyInstallation()) {
      dialog.showErrorBox(
        'Ruby Not Found',
        'Ruby is required to run SwarmUI. Please install Ruby and try again.\n\nVisit https://www.ruby-lang.org for installation instructions.'
      );
      app.quit();
      return;
    }

    if (!checkBundlerInstallation()) {
      dialog.showErrorBox(
        'Bundler Not Found',
        'Bundler is required to run SwarmUI. Please install it with:\n\ngem install bundler'
      );
      app.quit();
      return;
    }

    // Skip database migrations for now - assume database is already set up
    console.log('Skipping database setup - using existing database');
    // Find available port
    railsPort = await findAvailablePort(3000);
    console.log(`Starting Rails server on port ${railsPort}`);

    // Set up environment
    const env = Object.assign({}, process.env, {
      PORT: railsPort,
      RAILS_ENV: 'development',
      RAILS_SERVE_STATIC_FILES: 'true',
      SECRET_KEY_BASE:
        process.env.SECRET_KEY_BASE || 'development-secret-key-base-for-electron-app-only',
      // Use async adapter for ActionCable to avoid Redis dependency
      ACTION_CABLE_ADAPTER: 'async',
      // Indicate we're running in Electron
      ELECTRON_APP: 'true',
      // Pass ttyd port to Rails
      TTYD_PORT: ttydPort.toString(),
    });

    // Change to Rails app directory
    const railsRoot = path.join(__dirname, '..');

    // Start Rails server
    railsProcess = spawn('bundle', ['exec', 'rails', 'server', '-p', railsPort, '-b', '0.0.0.0'], {
      cwd: railsRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Log Rails output
    railsProcess.stdout.on('data', (data) => {
      console.log(`Rails: ${data.toString().trim()}`);
    });

    railsProcess.stderr.on('data', (data) => {
      console.error(`Rails Error: ${data.toString().trim()}`);
    });

    railsProcess.on('error', (error) => {
      console.error('Failed to start Rails server:', error);
      app.quit();
    });

    railsProcess.on('exit', (code) => {
      console.log(`Rails server exited with code ${code}`);
      if (code !== 0 && code !== null) {
        app.quit();
      }
    });

    // Wait for server to be ready
    await waitForRailsServer(railsPort);
  } catch (error) {
    console.error('Error starting Rails server:', error);
    app.quit();
  }
}

// Start ttyd server
async function startTtydServer() {
  try {
    // Find available port for ttyd
    ttydPort = await findAvailablePort(8999);
    console.log(`Starting ttyd server on port ${ttydPort}`);

    // Check if ttyd binary exists
    const ttydBinary = path.join(
      __dirname,
      '..',
      'bundled',
      'binaries',
      `ttyd-${process.platform}-${process.arch}`
    );
    const systemTtyd = 'ttyd'; // Fallback to system ttyd

    let ttydCommand = systemTtyd;
    if (fs.existsSync(ttydBinary)) {
      ttydCommand = ttydBinary;
      console.log('Using bundled ttyd binary');
    } else {
      console.log('Using system ttyd (if available)');
    }

    // Start ttyd
    ttydProcess = spawn(
      ttydCommand,
      [
        '-p',
        ttydPort.toString(),
        '-W', // Writable
        '-a', // Allow all origins
        '-t',
        'fontSize=14',
        '-t',
        'macOptionClickForcesSelection=true',
        path.join(__dirname, '..', 'bin', 'ttyd'),
      ],
      {
        env: Object.assign({}, process.env, {
          TTYD_PORT: ttydPort.toString(),
        }),
      }
    );

    ttydProcess.stdout.on('data', (data) => {
      console.log(`ttyd: ${data.toString().trim()}`);
    });

    ttydProcess.stderr.on('data', (data) => {
      console.error(`ttyd Error: ${data.toString().trim()}`);
    });

    ttydProcess.on('error', (error) => {
      console.error('Failed to start ttyd:', error);
      console.log('Terminal features will be disabled. To enable them, install ttyd.');
      // Continue without ttyd - it's not critical
      ttydProcess = null;
    });

    ttydProcess.on('exit', (code) => {
      console.log(`ttyd exited with code ${code}`);
    });
  } catch (error) {
    console.error('Error starting ttyd:', error);
    // Continue without ttyd - it's not critical
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  // Load the Rails app with cache busting
  mainWindow.loadURL(`http://localhost:${railsPort}`);
  
  // Clear cache on first load to ensure fresh assets
  mainWindow.webContents.session.clearCache();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(async () => {
  await startRailsServer();
  await startTtydServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill Rails server when app quits
  if (railsProcess) {
    console.log('Stopping Rails server...');
    railsProcess.kill('SIGTERM');

    // Give it time to shutdown gracefully, then force kill
    setTimeout(() => {
      if (railsProcess) {
        railsProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  // Kill ttyd server
  if (ttydProcess) {
    console.log('Stopping ttyd server...');
    ttydProcess.kill('SIGTERM');

    setTimeout(() => {
      if (ttydProcess) {
        ttydProcess.kill('SIGKILL');
      }
    }, 1000);
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
