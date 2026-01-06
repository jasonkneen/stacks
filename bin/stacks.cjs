#!/usr/bin/env node

/**
 * npx launcher for Stacks
 * Downloads and caches Electron binary on first run, then launches the app
 * Electron is cached in ~/.stacks/ for persistence across npx runs
 */

const { spawn, execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const APP_NAME = 'stacks'
const APP_DIR = path.join(__dirname, '..')
const CACHE_DIR = path.join(os.homedir(), '.stacks')
const ELECTRON_CACHE = path.join(CACHE_DIR, 'electron')

let proxyProcess = null

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
  if (!fs.existsSync(ELECTRON_CACHE)) {
    fs.mkdirSync(ELECTRON_CACHE, { recursive: true })
  }
}

function getElectronPath() {
  const platform = os.platform()
  const electronBin = platform === 'win32' ? 'electron.cmd' : 'electron'
  return path.join(ELECTRON_CACHE, 'node_modules', '.bin', electronBin)
}

function getNpmCommand() {
  return os.platform() === 'win32' ? 'npm.cmd' : 'npm'
}

function getNodeCommand() {
  return process.execPath
}

async function ensureElectron() {
  ensureCacheDir()

  const electronPath = getElectronPath()

  // Check if electron is already cached
  if (fs.existsSync(electronPath)) {
    return electronPath
  }

  console.log('☐ Installing Electron (first run only)...')
  console.log(`  Cache location: ${ELECTRON_CACHE}`)

  try {
    // Create a minimal package.json for electron installation
    const pkgPath = path.join(ELECTRON_CACHE, 'package.json')
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: 'stacks-electron-cache',
      version: '1.0.0',
      private: true
    }))

    // Install electron to cache directory using execFileSync (safer than execSync)
    const npm = getNpmCommand()
    execFileSync(npm, ['install', 'electron@latest', '--no-save', '--no-audit', '--no-fund'], {
      cwd: ELECTRON_CACHE,
      stdio: 'inherit'
    })

    console.log('✓ Electron installed successfully!\n')
    return electronPath
  } catch (error) {
    console.error('✗ Failed to install Electron:', error.message)
    console.error('\nTry installing manually:')
    console.error(`  cd ${ELECTRON_CACHE} && npm install electron`)
    process.exit(1)
  }
}

function checkBuilt() {
  const distDir = path.join(APP_DIR, 'dist')
  const indexHtml = path.join(distDir, 'index.html')

  if (!fs.existsSync(indexHtml)) {
    console.error('✗ App not built. dist/index.html not found.')
    console.error('\nIf you cloned from source, run:')
    console.error('  npm install && npm run build')
    process.exit(1)
  }
}

function startProxy() {
  const proxyPath = path.join(APP_DIR, 'dist', 'mcp', 'proxy.js')

  if (!fs.existsSync(proxyPath)) {
    console.log('⚠ MCP proxy not found, skipping...')
    return null
  }

  console.log('☐ Starting MCP proxy...')

  const node = getNodeCommand()
  proxyProcess = spawn(node, [proxyPath], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production'
    },
    detached: false
  })

  proxyProcess.stdout.on('data', () => {
    // Proxy logs go to stderr by design, stdout is for JSON-RPC
  })

  proxyProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg.includes('ready')) {
      console.log('✓ MCP proxy ready')
    }
  })

  proxyProcess.on('error', (err) => {
    console.error('⚠ Proxy error:', err.message)
  })

  return proxyProcess
}

function stopProxy() {
  if (proxyProcess) {
    proxyProcess.kill()
    proxyProcess = null
  }
}

async function launch() {
  try {
    console.log(`\n🚀 Starting Stacks...\n`)

    checkBuilt()
    startProxy()
    const electronPath = await ensureElectron()

    // Launch Electron with the app
    const child = spawn(electronPath, [APP_DIR], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    })

    child.on('exit', (code) => {
      stopProxy()
      process.exit(code || 0)
    })

    child.on('error', (err) => {
      console.error('Failed to start Electron:', err.message)
      stopProxy()
      process.exit(1)
    })

    // Handle signals
    process.on('SIGINT', () => {
      stopProxy()
      child.kill('SIGINT')
    })
    process.on('SIGTERM', () => {
      stopProxy()
      child.kill('SIGTERM')
    })

  } catch (error) {
    console.error('Failed to launch Stacks:', error.message)
    stopProxy()
    process.exit(1)
  }
}

// CLI arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Stacks - AI-powered infinite canvas

Usage:
  npx stacks          Launch the app
  npx stacks --clean  Clear cached Electron installation
  npx stacks --help   Show this help message

Cache location: ${CACHE_DIR}
`)
  process.exit(0)
}

if (args.includes('--clean')) {
  console.log('Cleaning Electron cache...')
  if (fs.existsSync(ELECTRON_CACHE)) {
    fs.rmSync(ELECTRON_CACHE, { recursive: true })
    console.log('✓ Cache cleared')
  } else {
    console.log('Cache already empty')
  }
  process.exit(0)
}

launch()
