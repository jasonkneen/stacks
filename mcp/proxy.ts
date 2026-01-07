#!/usr/bin/env node
/**
 * MCP Proxy Server
 *
 * Bridges browser WebSocket connections to stdio MCP servers.
 * Allows the Stacks app to consume external MCP servers.
 */

import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Types
interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

interface ProxyConfig {
  port: number;
  servers: Record<string, MCPServerConfig>;
}

interface MCPConnection {
  process: ChildProcess;
  config: MCPServerConfig;
  pendingRequests: Map<string | number, (response: any) => void>;
  tools: any[];
  resources: any[];
  prompts: any[];
  ready: boolean;
}

interface ClientMessage {
  type: "list_servers" | "connect" | "disconnect" | "call_tool" | "list_tools" | "read_resource" | "list_resources" | "get_prompt" | "list_prompts" | "add_server" | "remove_server" | "get_config";
  serverId?: string;
  params?: any;
  requestId?: string | number;
}

const configDir = join(homedir(), ".stacks");
const legacyConfigDir = join(homedir(), ".spatial");
const configPath = join(configDir, "mcp-proxy-config.json");
const legacyConfigPath = join(legacyConfigDir, "mcp-proxy-config.json");

// Default config
const DEFAULT_CONFIG: ProxyConfig = {
  port: 3099,
  servers: {}
};

function loadConfig(): ProxyConfig {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  if (existsSync(legacyConfigPath) && !existsSync(configPath)) {
    copyFileSync(legacyConfigPath, configPath);
    console.log("Migrated MCP config from ~/.spatial to ~/.stacks");
  }
  
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: ProxyConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// MCP Server management
const connections = new Map<string, MCPConnection>();
let config = loadConfig();
let requestCounter = 0;

function generateRequestId(): number {
  return ++requestCounter;
}

async function connectToServer(serverId: string): Promise<MCPConnection | null> {
  const serverConfig = config.servers[serverId];
  if (!serverConfig) {
    console.error(`Server ${serverId} not found in config`);
    return null;
  }

  if (connections.has(serverId)) {
    return connections.get(serverId)!;
  }

  console.error(`Starting MCP server: ${serverId}`);

  const proc = spawn(serverConfig.command, serverConfig.args || [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...serverConfig.env },
  });

  const connection: MCPConnection = {
    process: proc,
    config: serverConfig,
    pendingRequests: new Map(),
    tools: [],
    resources: [],
    prompts: [],
    ready: false,
  };

  connections.set(serverId, connection);

  // Buffer for partial JSON messages
  let buffer = "";

  proc.stdout?.on("data", (data: Buffer) => {
    buffer += data.toString();

    // Try to parse complete JSON-RPC messages
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        handleServerMessage(serverId, message);
      } catch (e) {
        console.error(`Failed to parse message from ${serverId}:`, line);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    console.error(`[${serverId}] ${data.toString()}`);
  });

  proc.on("error", (err) => {
    console.error(`Server ${serverId} error:`, err);
    connections.delete(serverId);
  });

  proc.on("exit", (code) => {
    console.error(`Server ${serverId} exited with code ${code}`);
    connections.delete(serverId);
  });

  // Initialize the connection
  await sendRequest(serverId, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {
      roots: { listChanged: true },
    },
    clientInfo: {
      name: "stacks",
      version: "1.0.0",
    },
  });

  // Send initialized notification
  sendNotification(serverId, "notifications/initialized", {});

  // Fetch capabilities
  await refreshServerCapabilities(serverId);

  connection.ready = true;
  return connection;
}

async function refreshServerCapabilities(serverId: string): Promise<void> {
  const connection = connections.get(serverId);
  if (!connection) return;

  try {
    // Get tools
    const toolsResponse = await sendRequest(serverId, "tools/list", {});
    connection.tools = toolsResponse?.tools || [];

    // Get resources
    try {
      const resourcesResponse = await sendRequest(serverId, "resources/list", {});
      connection.resources = resourcesResponse?.resources || [];
    } catch {
      connection.resources = [];
    }

    // Get prompts
    try {
      const promptsResponse = await sendRequest(serverId, "prompts/list", {});
      connection.prompts = promptsResponse?.prompts || [];
    } catch {
      connection.prompts = [];
    }
  } catch (e) {
    console.error(`Failed to refresh capabilities for ${serverId}:`, e);
  }
}

function disconnectServer(serverId: string): void {
  const connection = connections.get(serverId);
  if (connection) {
    connection.process.kill();
    connections.delete(serverId);
    console.error(`Disconnected server: ${serverId}`);
  }
}

function sendRequest(serverId: string, method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const connection = connections.get(serverId);
    if (!connection) {
      reject(new Error(`Server ${serverId} not connected`));
      return;
    }

    const id = generateRequestId();
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    connection.pendingRequests.set(id, (response) => {
      if (response.error) {
        reject(new Error(response.error.message || "Unknown error"));
      } else {
        resolve(response.result);
      }
    });

    connection.process.stdin?.write(JSON.stringify(message) + "\n");

    // Timeout after 30 seconds
    setTimeout(() => {
      if (connection.pendingRequests.has(id)) {
        connection.pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 30000);
  });
}

function sendNotification(serverId: string, method: string, params: any): void {
  const connection = connections.get(serverId);
  if (!connection) return;

  const message = {
    jsonrpc: "2.0",
    method,
    params,
  };

  connection.process.stdin?.write(JSON.stringify(message) + "\n");
}

function handleServerMessage(serverId: string, message: any): void {
  const connection = connections.get(serverId);
  if (!connection) return;

  if (message.id !== undefined && connection.pendingRequests.has(message.id)) {
    const resolve = connection.pendingRequests.get(message.id)!;
    connection.pendingRequests.delete(message.id);
    resolve(message);
  }
}

// WebSocket server
const wss = new WebSocketServer({ port: config.port });

console.error(`MCP Proxy Server starting on ws://localhost:${config.port}`);

wss.on("connection", (ws: WebSocket) => {
  console.error("Client connected");

  ws.on("message", async (data: Buffer) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      const response = await handleClientMessage(message);
      ws.send(JSON.stringify({ requestId: message.requestId, ...response }));
    } catch (e) {
      console.error("Error handling client message:", e);
      ws.send(JSON.stringify({ error: String(e) }));
    }
  });

  ws.on("close", () => {
    console.error("Client disconnected");
  });
});

async function handleClientMessage(message: ClientMessage): Promise<any> {
  switch (message.type) {
    case "get_config":
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
      };

    case "list_servers":
      const serverList = Object.entries(config.servers).map(([id, cfg]) => {
        const conn = connections.get(id);
        return {
          id,
          command: cfg.command,
          connected: !!conn,
          ready: conn?.ready || false,
          toolCount: conn?.tools.length || 0,
          resourceCount: conn?.resources.length || 0,
          promptCount: conn?.prompts.length || 0,
        };
      });
      return { servers: serverList };

    case "connect":
      if (!message.serverId) return { error: "serverId required" };
      const conn = await connectToServer(message.serverId);
      if (conn) {
        return {
          connected: true,
          tools: conn.tools,
          resources: conn.resources,
          prompts: conn.prompts,
        };
      }
      return { error: "Failed to connect" };

    case "disconnect":
      if (!message.serverId) return { error: "serverId required" };
      disconnectServer(message.serverId);
      return { disconnected: true };

    case "list_tools":
      if (message.serverId) {
        const c = connections.get(message.serverId);
        return { tools: c?.tools || [] };
      }
      // All tools from all connected servers
      const allTools: any[] = [];
      for (const [serverId, conn] of connections) {
        for (const tool of conn.tools) {
          allTools.push({ ...tool, serverId });
        }
      }
      return { tools: allTools };

    case "call_tool":
      if (!message.serverId || !message.params?.name) {
        return { error: "serverId and params.name required" };
      }
      try {
        const result = await sendRequest(message.serverId, "tools/call", {
          name: message.params.name,
          arguments: message.params.arguments || {},
        });
        return { result };
      } catch (e) {
        return { error: String(e) };
      }

    case "list_resources":
      if (message.serverId) {
        const c = connections.get(message.serverId);
        return { resources: c?.resources || [] };
      }
      const allResources: any[] = [];
      for (const [serverId, conn] of connections) {
        for (const resource of conn.resources) {
          allResources.push({ ...resource, serverId });
        }
      }
      return { resources: allResources };

    case "read_resource":
      if (!message.serverId || !message.params?.uri) {
        return { error: "serverId and params.uri required" };
      }
      try {
        const result = await sendRequest(message.serverId, "resources/read", {
          uri: message.params.uri,
        });
        return { result };
      } catch (e) {
        return { error: String(e) };
      }

    case "list_prompts":
      if (message.serverId) {
        const c = connections.get(message.serverId);
        return { prompts: c?.prompts || [] };
      }
      const allPrompts: any[] = [];
      for (const [serverId, conn] of connections) {
        for (const prompt of conn.prompts) {
          allPrompts.push({ ...prompt, serverId });
        }
      }
      return { prompts: allPrompts };

    case "get_prompt":
      if (!message.serverId || !message.params?.name) {
        return { error: "serverId and params.name required" };
      }
      try {
        const result = await sendRequest(message.serverId, "prompts/get", {
          name: message.params.name,
          arguments: message.params.arguments || {},
        });
        return { result };
      } catch (e) {
        return { error: String(e) };
      }

    case "add_server":
      if (!message.params?.id || !message.params?.command) {
        return { error: "params.id and params.command required" };
      }
      config.servers[message.params.id] = {
        command: message.params.command,
        args: message.params.args || [],
        env: message.params.env || {},
        enabled: true,
      };
      saveConfig(config);
      return { added: true, serverId: message.params.id };

    case "remove_server":
      if (!message.serverId) return { error: "serverId required" };
      disconnectServer(message.serverId);
      delete config.servers[message.serverId];
      saveConfig(config);
      return { removed: true };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// Auto-connect to enabled servers
async function autoConnect() {
  for (const [serverId, serverConfig] of Object.entries(config.servers)) {
    if (serverConfig.enabled !== false) {
      try {
        await connectToServer(serverId);
      } catch (e) {
        console.error(`Failed to auto-connect to ${serverId}:`, e);
      }
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("\nShutting down...");
  for (const serverId of connections.keys()) {
    disconnectServer(serverId);
  }
  wss.close();
  process.exit(0);
});

// Start
autoConnect().then(() => {
  console.error(`MCP Proxy ready on ws://localhost:${config.port}`);
  console.error(`Config: ${configPath}`);
});
