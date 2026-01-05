import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface MCPServer {
  id: string;
  command: string;
  args?: string[];
  connected: boolean;
  ready: boolean;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
  serverId: string;
}

interface MCPClientState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  servers: MCPServer[];
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

interface UseMCPClientOptions {
  proxyUrl?: string;
  autoConnect?: boolean;
}

const DEFAULT_PROXY_URL = 'ws://localhost:3099';

export function useMCPClient(options: UseMCPClientOptions = {}) {
  const { proxyUrl = DEFAULT_PROXY_URL, autoConnect = true } = options;

  const [state, setState] = useState<MCPClientState>({
    connected: false,
    connecting: false,
    error: null,
    servers: [],
    tools: [],
    resources: [],
    prompts: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>>(new Map());

  // Send request to proxy
  const sendRequest = useCallback((type: string, params?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to MCP proxy'));
        return;
      }

      const requestId = `req-${++requestIdRef.current}`;
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      const message = { type, requestId, ...params };
      wsRef.current.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, []);

  // Connect to proxy
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState(s => ({ ...s, connecting: true, error: null }));

    const ws = new WebSocket(proxyUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setState(s => ({ ...s, connected: true, connecting: false }));
      // Fetch initial state
      try {
        const serversRes = await sendRequest('list_servers');
        const toolsRes = await sendRequest('list_tools');
        const resourcesRes = await sendRequest('list_resources');
        const promptsRes = await sendRequest('list_prompts');

        setState(s => ({
          ...s,
          servers: serversRes.servers || [],
          tools: toolsRes.tools || [],
          resources: resourcesRes.resources || [],
          prompts: promptsRes.prompts || [],
        }));
      } catch (e) {
        console.error('Failed to fetch MCP state:', e);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.requestId && pendingRequestsRef.current.has(data.requestId)) {
          const { resolve, reject } = pendingRequestsRef.current.get(data.requestId)!;
          pendingRequestsRef.current.delete(data.requestId);

          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        }
      } catch (e) {
        console.error('Failed to parse MCP message:', e);
      }
    };

    ws.onerror = () => {
      setState(s => ({ ...s, error: 'WebSocket error', connecting: false }));
    };

    ws.onclose = () => {
      setState(s => ({
        ...s,
        connected: false,
        connecting: false,
        servers: [],
        tools: [],
        resources: [],
        prompts: [],
      }));
      wsRef.current = null;
    };
  }, [proxyUrl, sendRequest]);

  // Disconnect
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // Connect to a specific MCP server
  const connectServer = useCallback(async (serverId: string) => {
    const result = await sendRequest('connect', { serverId });
    // Refresh state
    const serversRes = await sendRequest('list_servers');
    const toolsRes = await sendRequest('list_tools');
    const resourcesRes = await sendRequest('list_resources');
    const promptsRes = await sendRequest('list_prompts');

    setState(s => ({
      ...s,
      servers: serversRes.servers || [],
      tools: toolsRes.tools || [],
      resources: resourcesRes.resources || [],
      prompts: promptsRes.prompts || [],
    }));

    return result;
  }, [sendRequest]);

  // Disconnect a specific MCP server
  const disconnectServer = useCallback(async (serverId: string) => {
    await sendRequest('disconnect', { serverId });
    // Refresh state
    const serversRes = await sendRequest('list_servers');
    const toolsRes = await sendRequest('list_tools');

    setState(s => ({
      ...s,
      servers: serversRes.servers || [],
      tools: toolsRes.tools || [],
    }));
  }, [sendRequest]);

  // Add a new MCP server
  const addServer = useCallback(async (id: string, command: string, args?: string[], env?: Record<string, string>) => {
    const result = await sendRequest('add_server', {
      params: { id, command, args, env }
    });
    // Refresh servers list
    const serversRes = await sendRequest('list_servers');
    setState(s => ({ ...s, servers: serversRes.servers || [] }));
    return result;
  }, [sendRequest]);

  // Remove an MCP server
  const removeServer = useCallback(async (serverId: string) => {
    await sendRequest('remove_server', { serverId });
    // Refresh state
    const serversRes = await sendRequest('list_servers');
    const toolsRes = await sendRequest('list_tools');

    setState(s => ({
      ...s,
      servers: serversRes.servers || [],
      tools: toolsRes.tools || [],
    }));
  }, [sendRequest]);

  // Call a tool
  const callTool = useCallback(async (serverId: string, toolName: string, args?: Record<string, any>) => {
    const result = await sendRequest('call_tool', {
      serverId,
      params: { name: toolName, arguments: args }
    });
    return result.result;
  }, [sendRequest]);

  // Read a resource
  const readResource = useCallback(async (serverId: string, uri: string) => {
    const result = await sendRequest('read_resource', {
      serverId,
      params: { uri }
    });
    return result.result;
  }, [sendRequest]);

  // Get a prompt
  const getPrompt = useCallback(async (serverId: string, promptName: string, args?: Record<string, string>) => {
    const result = await sendRequest('get_prompt', {
      serverId,
      params: { name: promptName, arguments: args }
    });
    return result.result;
  }, [sendRequest]);

  // Refresh all state
  const refresh = useCallback(async () => {
    if (!state.connected) return;

    const serversRes = await sendRequest('list_servers');
    const toolsRes = await sendRequest('list_tools');
    const resourcesRes = await sendRequest('list_resources');
    const promptsRes = await sendRequest('list_prompts');

    setState(s => ({
      ...s,
      servers: serversRes.servers || [],
      tools: toolsRes.tools || [],
      resources: resourcesRes.resources || [],
      prompts: promptsRes.prompts || [],
    }));
  }, [state.connected, sendRequest]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // State
    connected: state.connected,
    connecting: state.connecting,
    error: state.error,
    servers: state.servers,
    tools: state.tools,
    resources: state.resources,
    prompts: state.prompts,

    // Actions
    connect,
    disconnect,
    connectServer,
    disconnectServer,
    addServer,
    removeServer,
    callTool,
    readResource,
    getPrompt,
    refresh,
  };
}
