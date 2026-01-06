#!/usr/bin/env node

/**
 * npx launcher for Spatial
 * Downloads and caches Electron binary on first run, then launches the app
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execSync } = require('child_process')

const APP_NAME = 'spatial'
const APP_DIR = path.join(__dirname, '..')

async function ensureElectron() {
  // Check if electron is already in node_modules
  const localElectronPath = path.join(APP_DIR, 'node_modules', '.bin', 'electron')

  if (fs.existsSync(localElectronPath)) {
    return localElectronPath
  }

  console.log('Installing Electron (first run only)...')

  try {
    // Install electron locally
    execSync('npm install --no-save electron@latest', {
      cwd: APP_DIR,
      stdio: 'inherit'
    })

    return localElectronPath
  } catch (error) {
    console.error('Failed to install Electron:', error.message)
    process.exit(1)
  }
}

async function launch() {
  try {
    const electronPath = await ensureElectron()

    // Launch Electron with the app
    const child = spawn(electronPath, [APP_DIR], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    })

    child.on('exit', (code) => {
      process.exit(code || 0)
    })

    // Handle signals
    process.on('SIGINT', () => {
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      child.kill('SIGTERM')
    })

  } catch (error) {
    console.error('Failed to launch Spatial:', error.message)
    process.exit(1)
  }
}

launch()
