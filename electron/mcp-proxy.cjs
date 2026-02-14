/**
 * MCP Proxy Server (embedded in Electron main process)
 *
 * Bridges browser WebSocket connections to stdio MCP servers.
 * Allows the Stacks app to consume external MCP servers.
 */

const { WebSocketServer } = require('ws')
const { spawn } = require('child_process')
const { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } = require('fs')
const { homedir } = require('os')
const { join } = require('path')

const configDir = join(homedir(), '.stacks')
const legacyConfigDir = join(homedir(), '.spatial')
const configPath = join(configDir, 'mcp-proxy-config.json')
const legacyConfigPath = join(legacyConfigDir, 'mcp-proxy-config.json')

const DEFAULT_CONFIG = {
  port: 3099,
  servers: {}
}

let wss = null
const connections = new Map()
let config = null
let requestCounter = 0

function loadConfig() {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  if (existsSync(legacyConfigPath) && !existsSync(configPath)) {
    copyFileSync(legacyConfigPath, configPath)
    console.log('[MCP Proxy] Migrated config from ~/.spatial to ~/.stacks')
  }

  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return DEFAULT_CONFIG
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(cfg) {
  writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

function generateRequestId() {
  return ++requestCounter
}

async function connectToServer(serverId) {
  const serverConfig = config.servers[serverId]
  if (!serverConfig) {
    console.error(`[MCP Proxy] Server ${serverId} not found in config`)
    return null
  }

  if (connections.has(serverId)) {
    return connections.get(serverId)
  }

  console.log(`[MCP Proxy] Starting MCP server: ${serverId}`)

  const proc = spawn(serverConfig.command, serverConfig.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...serverConfig.env },
  })

  const connection = {
    process: proc,
    config: serverConfig,
    pendingRequests: new Map(),
    tools: [],
    resources: [],
    prompts: [],
    ready: false,
  }

  connections.set(serverId, connection)

  let buffer = ''

  proc.stdout.on('data', (data) => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const message = JSON.parse(line)
        handleServerMessage(serverId, message)
      } catch (e) {
        console.error(`[MCP Proxy] Failed to parse message from ${serverId}:`, line)
      }
    }
  })

  proc.stderr.on('data', (data) => {
    console.error(`[MCP Proxy] [${serverId}] ${data.toString()}`)
  })

  proc.on('error', (err) => {
    console.error(`[MCP Proxy] Server ${serverId} error:`, err)
    connections.delete(serverId)
  })

  proc.on('exit', (code) => {
    console.log(`[MCP Proxy] Server ${serverId} exited with code ${code}`)
    connections.delete(serverId)
  })

  await sendRequest(serverId, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {
      roots: { listChanged: true },
    },
    clientInfo: {
      name: 'stacks',
      version: '1.0.0',
    },
  })

  sendNotification(serverId, 'notifications/initialized', {})
  await refreshServerCapabilities(serverId)

  connection.ready = true
  return connection
}

async function refreshServerCapabilities(serverId) {
  const connection = connections.get(serverId)
  if (!connection) return

  try {
    const toolsResponse = await sendRequest(serverId, 'tools/list', {})
    connection.tools = toolsResponse?.tools || []

    try {
      const resourcesResponse = await sendRequest(serverId, 'resources/list', {})
      connection.resources = resourcesResponse?.resources || []
    } catch {
      connection.resources = []
    }

    try {
      const promptsResponse = await sendRequest(serverId, 'prompts/list', {})
      connection.prompts = promptsResponse?.prompts || []
    } catch {
      connection.prompts = []
    }
  } catch (e) {
    console.error(`[MCP Proxy] Failed to refresh capabilities for ${serverId}:`, e)
  }
}

function disconnectServer(serverId) {
  const connection = connections.get(serverId)
  if (connection) {
    connection.process.kill()
    connections.delete(serverId)
    console.log(`[MCP Proxy] Disconnected server: ${serverId}`)
  }
}

function sendRequest(serverId, method, params) {
  return new Promise((resolve, reject) => {
    const connection = connections.get(serverId)
    if (!connection) {
      reject(new Error(`Server ${serverId} not connected`))
      return
    }

    const id = generateRequestId()
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    connection.pendingRequests.set(id, (response) => {
      if (response.error) {
        reject(new Error(response.error.message || 'Unknown error'))
      } else {
        resolve(response.result)
      }
    })

    connection.process.stdin.write(JSON.stringify(message) + '\n')

    setTimeout(() => {
      if (connection.pendingRequests.has(id)) {
        connection.pendingRequests.delete(id)
        reject(new Error('Request timeout'))
      }
    }, 30000)
  })
}

function sendNotification(serverId, method, params) {
  const connection = connections.get(serverId)
  if (!connection) return

  const message = {
    jsonrpc: '2.0',
    method,
    params,
  }

  connection.process.stdin.write(JSON.stringify(message) + '\n')
}

function handleServerMessage(serverId, message) {
  const connection = connections.get(serverId)
  if (!connection) return

  if (message.id !== undefined && connection.pendingRequests.has(message.id)) {
    const resolve = connection.pendingRequests.get(message.id)
    connection.pendingRequests.delete(message.id)
    resolve(message)
  }
}

async function handleClientMessage(message) {
  switch (message.type) {
    case 'get_config':
      return {
        config: {
          port: config.port,
          servers: Object.entries(config.servers).map(([id, cfg]) => ({
            id,
            command: cfg.command,
            args: cfg.args,
            enabled: cfg.enabled !== false,
            connected: connections.has(id),
          })),
        },
      }

    case 'list_servers': {
      const serverList = Object.entries(config.servers).map(([id, cfg]) => {
        const conn = connections.get(id)
        return {
          id,
          command: cfg.command,
          connected: !!conn,
          ready: conn?.ready || false,
          toolCount: conn?.tools.length || 0,
          resourceCount: conn?.resources.length || 0,
          promptCount: conn?.prompts.length || 0,
        }
      })
      return { servers: serverList }
    }

    case 'connect':
      if (!message.serverId) return { error: 'serverId required' }
      const conn = await connectToServer(message.serverId)
      if (conn) {
        return {
          connected: true,
          tools: conn.tools,
          resources: conn.resources,
          prompts: conn.prompts,
        }
      }
      return { error: 'Failed to connect' }

    case 'disconnect':
      if (!message.serverId) return { error: 'serverId required' }
      disconnectServer(message.serverId)
      return { disconnected: true }

    case 'list_tools':
      if (message.serverId) {
        const c = connections.get(message.serverId)
        return { tools: c?.tools || [] }
      }
      const allTools = []
      for (const [serverId, conn] of connections) {
        for (const tool of conn.tools) {
          allTools.push({ ...tool, serverId })
        }
      }
      return { tools: allTools }

    case 'call_tool':
      if (!message.serverId || !message.params?.name) {
        return { error: 'serverId and params.name required' }
      }
      try {
        const result = await sendRequest(message.serverId, 'tools/call', {
          name: message.params.name,
          arguments: message.params.arguments || {},
        })
        return { result }
      } catch (e) {
        return { error: String(e) }
      }

    case 'list_resources':
      if (message.serverId) {
        const c = connections.get(message.serverId)
        return { resources: c?.resources || [] }
      }
      const allResources = []
      for (const [serverId, conn] of connections) {
        for (const resource of conn.resources) {
          allResources.push({ ...resource, serverId })
        }
      }
      return { resources: allResources }

    case 'read_resource':
      if (!message.serverId || !message.params?.uri) {
        return { error: 'serverId and params.uri required' }
      }
      try {
        const result = await sendRequest(message.serverId, 'resources/read', {
          uri: message.params.uri,
        })
        return { result }
      } catch (e) {
        return { error: String(e) }
      }

    case 'list_prompts':
      if (message.serverId) {
        const c = connections.get(message.serverId)
        return { prompts: c?.prompts || [] }
      }
      const allPrompts = []
      for (const [serverId, conn] of connections) {
        for (const prompt of conn.prompts) {
          allPrompts.push({ ...prompt, serverId })
        }
      }
      return { prompts: allPrompts }

    case 'get_prompt':
      if (!message.serverId || !message.params?.name) {
        return { error: 'serverId and params.name required' }
      }
      try {
        const result = await sendRequest(message.serverId, 'prompts/get', {
          name: message.params.name,
          arguments: message.params.arguments || {},
        })
        return { result }
      } catch (e) {
        return { error: String(e) }
      }

    case 'add_server':
      if (!message.params?.id || !message.params?.command) {
        return { error: 'params.id and params.command required' }
      }
      config.servers[message.params.id] = {
        command: message.params.command,
        args: message.params.args || [],
        env: message.params.env || {},
        enabled: true,
      }
      saveConfig(config)
      return { added: true, serverId: message.params.id }

    case 'remove_server':
      if (!message.serverId) return { error: 'serverId required' }
      disconnectServer(message.serverId)
      delete config.servers[message.serverId]
      saveConfig(config)
      return { removed: true }

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}

async function autoConnect() {
  for (const [serverId, serverConfig] of Object.entries(config.servers)) {
    if (serverConfig.enabled !== false) {
      try {
        await connectToServer(serverId)
      } catch (e) {
        console.error(`[MCP Proxy] Failed to auto-connect to ${serverId}:`, e)
      }
    }
  }
}

function startMCPProxy() {
  config = loadConfig()
  wss = new WebSocketServer({ port: config.port })

  console.log(`[MCP Proxy] Starting on ws://localhost:${config.port}`)

  wss.on('connection', (ws) => {
    console.log('[MCP Proxy] Client connected')

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        const response = await handleClientMessage(message)
        ws.send(JSON.stringify({ requestId: message.requestId, ...response }))
      } catch (e) {
        console.error('[MCP Proxy] Error handling client message:', e)
        ws.send(JSON.stringify({ error: String(e) }))
      }
    })

    ws.on('close', () => {
      console.log('[MCP Proxy] Client disconnected')
    })
  })

  autoConnect().then(() => {
    console.log(`[MCP Proxy] Ready on ws://localhost:${config.port}`)
    console.log(`[MCP Proxy] Config: ${configPath}`)
  })
}

function stopMCPProxy() {
  for (const serverId of connections.keys()) {
    disconnectServer(serverId)
  }
  if (wss) {
    wss.close()
    wss = null
  }
  console.log('[MCP Proxy] Stopped')
}

module.exports = { startMCPProxy, stopMCPProxy }
