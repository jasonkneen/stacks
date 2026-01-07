#!/usr/bin/env node

const { spawn, execFileSync, execFile } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const https = require('https')

const APP_NAME = 'stacks-ai'
const APP_DIR = path.join(__dirname, '..')
const CACHE_DIR = path.join(os.homedir(), '.stacks')
const ELECTRON_CACHE = path.join(CACHE_DIR, 'electron')
const UPDATE_CHECK_FILE = path.join(CACHE_DIR, 'last-update-check')
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000

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

function getCurrentVersion() {
  try {
    const pkgPath = path.join(APP_DIR, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    return pkg.version
  } catch {
    return null
  }
}

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(`https://registry.npmjs.org/${APP_NAME}/latest`, {
      headers: { 'Accept': 'application/json' },
      timeout: 5000
    }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null)
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const pkg = JSON.parse(data)
          resolve(pkg.version)
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function shouldCheckForUpdates() {
  try {
    if (!fs.existsSync(UPDATE_CHECK_FILE)) return true
    const lastCheck = parseInt(fs.readFileSync(UPDATE_CHECK_FILE, 'utf8'), 10)
    return Date.now() - lastCheck > UPDATE_CHECK_INTERVAL
  } catch {
    return true
  }
}

function recordUpdateCheck() {
  try {
    ensureCacheDir()
    fs.writeFileSync(UPDATE_CHECK_FILE, Date.now().toString())
  } catch {}
}

function compareVersions(current, latest) {
  if (!current || !latest) return 0
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return 1
    if ((l[i] || 0) < (c[i] || 0)) return -1
  }
  return 0
}

async function checkForUpdates() {
  if (!shouldCheckForUpdates()) return

  const current = getCurrentVersion()
  const latest = await fetchLatestVersion()
  recordUpdateCheck()

  if (compareVersions(current, latest) > 0) {
    console.log(`\n📦 Update available: v${current} → v${latest}`)
    console.log(`   Run: npx stacks-ai@latest`)
    console.log(`   Or:  npm install -g stacks-ai@latest\n`)
  }
}

async function performUpdate() {
  const current = getCurrentVersion()
  const latest = await fetchLatestVersion()

  if (!latest) {
    console.log('✗ Could not check for updates (network error)')
    return false
  }

  if (compareVersions(current, latest) <= 0) {
    console.log(`✓ Already on latest version (v${current})`)
    return false
  }

  console.log(`\n📦 Updating stacks-ai: v${current} → v${latest}...\n`)

  try {
    const npm = getNpmCommand()
    execFileSync(npm, ['install', '-g', `stacks-ai@${latest}`], { stdio: 'inherit' })
    console.log(`\n✓ Updated to v${latest}`)
    console.log('  Run stacks-ai again to use the new version.\n')
    return true
  } catch (error) {
    console.error('✗ Update failed:', error.message)
    console.error(`  Try manually: npm install -g stacks-ai@latest`)
    return false
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

    checkForUpdates()
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
  const version = getCurrentVersion() || 'unknown'
  console.log(`
Stacks v${version} - AI-powered infinite canvas

Usage:
  npx stacks-ai            Launch the app
  npx stacks-ai --update   Check for and install updates
  npx stacks-ai --version  Show current version
  npx stacks-ai --clean    Clear cached Electron installation
  npx stacks-ai --help     Show this help message

Cache location: ${CACHE_DIR}
`)
  process.exit(0)
}

if (args.includes('--version') || args.includes('-v')) {
  const version = getCurrentVersion() || 'unknown'
  console.log(`stacks-ai v${version}`)
  process.exit(0)
}

if (args.includes('--update') || args.includes('-u')) {
  performUpdate().then(updated => {
    process.exit(updated ? 0 : 1)
  })
} else if (args.includes('--clean')) {
  console.log('Cleaning Electron cache...')
  if (fs.existsSync(ELECTRON_CACHE)) {
    fs.rmSync(ELECTRON_CACHE, { recursive: true })
    console.log('✓ Cache cleared')
  } else {
    console.log('Cache already empty')
  }
  process.exit(0)
} else {
  launch()
}
