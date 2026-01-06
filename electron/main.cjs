const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let viteProcess = null
let serverPort = null

// Find an available port
async function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })
  })
}

// Wait for server to be ready
async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(port, 'localhost')
        socket.on('connect', () => {
          socket.destroy()
          resolve()
        })
        socket.on('error', reject)
      })
      return true
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  return false
}

// Start Vite dev server
async function startViteServer() {
  serverPort = await findAvailablePort(3000)
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
    setTimeout(async () => {
      const ready = await waitForServer(serverPort)
      if (ready) {
        console.log(`Vite server ready on http://localhost:${serverPort}`)
        resolve()
      } else {
        reject(new Error('Vite server failed to start'))
      }
    }, 2000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    title: 'Spatial',
    backgroundColor: '#000000'
  })

  // Load the Vite server URL
  mainWindow.loadURL(`http://localhost:${serverPort}`)

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await startViteServer()
    createWindow()
  } catch (error) {
    console.error('Failed to start application:', error)
    app.quit()
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
  // Kill vite process when app quits
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
