const { app, BrowserWindow, nativeImage } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const fs = require('fs')

// Set app name for macOS menu
app.name = 'Stacks'
if (process.platform === 'darwin') {
  app.setName('Stacks')
}

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let viteProcess = null
let serverPort = null

// Find an available port
function findAvailablePort(startPort) {
  if (!startPort) startPort = 3000
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        findAvailablePort(startPort + 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })
  })
}

// Wait for server to be ready
function waitForServer(port, maxAttempts) {
  if (!maxAttempts) maxAttempts = 30

  function attempt(i) {
    if (i >= maxAttempts) return Promise.resolve(false)

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(port, 'localhost')
      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('error', () => {
        setTimeout(() => {
          attempt(i + 1).then(resolve).catch(reject)
        }, 1000)
      })
    })
  }

  return attempt(0)
}

// Start Vite dev server
function startViteServer() {
  return findAvailablePort(3000).then((port) => {
    serverPort = port
    console.log(`Starting Vite server on port ${serverPort}...`)

    const appDir = path.join(__dirname, '..')

    return new Promise((resolve, reject) => {
      // Start vite server
      viteProcess = spawn('npx', ['vite', '--port', serverPort.toString(), '--host', '0.0.0.0'], {
        cwd: appDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          FORCE_COLOR: '1'
        }
      })

      viteProcess.stdout.on('data', (data) => {
        console.log(`[Vite] ${data}`)
      })

      viteProcess.stderr.on('data', (data) => {
        console.error(`[Vite Error] ${data}`)
      })

      viteProcess.on('error', (error) => {
        console.error('Failed to start Vite:', error)
        reject(error)
      })

      viteProcess.on('exit', (code) => {
        console.log(`Vite process exited with code ${code}`)
        if (!mainWindow || mainWindow.isDestroyed()) {
          app.quit()
        }
      })

      // Wait for server to be ready
      setTimeout(() => {
        waitForServer(serverPort).then((ready) => {
          if (ready) {
            console.log(`Vite server ready on http://localhost:${serverPort}`)
            resolve()
          } else {
            reject(new Error('Vite server failed to start'))
          }
        }).catch(reject)
      }, 2000)
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.icns'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev // Allow local file loading in production
    },
    title: 'Stacks',
    backgroundColor: '#000000'
  })

  if (isDev) {
    // Development: Load from Vite server
    mainWindow.loadURL(`http://localhost:${serverPort}`)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: Load from dist folder
    const distPath = path.join(__dirname, '..', 'dist', 'index.html')
    mainWindow.loadFile(distPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (isDev) {
    // Development: Start Vite first
    startViteServer()
      .then(() => {
        createWindow()
      })
      .catch((error) => {
        console.error('Failed to start application:', error)
        app.quit()
      })
  } else {
    // Production: Load directly from dist
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Kill vite process when app quits (dev mode only)
  if (viteProcess && !viteProcess.killed) {
    console.log('Stopping Vite server...')
    viteProcess.kill('SIGTERM')

    // Force kill after 2 seconds if still running
    setTimeout(() => {
      if (viteProcess && !viteProcess.killed) {
        viteProcess.kill('SIGKILL')
      }
    }, 2000)
  }
})
