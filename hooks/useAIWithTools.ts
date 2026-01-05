import { useCallback, useState } from 'react';
import { useMCPClient } from './useMCPClient';
import {
  generateWithTools,
  generateTextWithTools,
  generateTextStream,
  MCPToolDefinition,
  AIProvider
} from '../utils/aiProvider';

/**
 * Hook that combines MCP client with AI generation.
 * Supports Anthropic, OpenAI, and Google providers via AI SDK.
 */
export function useAIWithTools() {
  const mcp = useMCPClient({ autoConnect: true });
  const [provider, setProvider] = useState<AIProvider>(
    (localStorage.getItem('ai-provider') as AIProvider) || 'google'
  );

  // Convert MCP tools to the format expected by generateWithTools
  const getToolDefinitions = useCallback((): MCPToolDefinition[] => {
    return mcp.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverId: tool.serverId,
    }));
  }, [mcp.tools]);

  // Handler for tool calls from Gemini
  const handleToolCall = useCallback(async (
    serverId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> => {
    const result = await mcp.callTool(serverId, toolName, args);

    // Extract text content from MCP response
    if (result?.content) {
      const textContent = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      return textContent || result;
    }

    return result;
  }, [mcp.callTool]);

  // Generate text with MCP tools (streaming)
  const generate = useCallback(async (
    prompt: string,
    onChunk: (text: string) => void,
    options?: {
      maxToolCalls?: number;
      systemPrompt?: string;
      useTools?: boolean;
      provider?: AIProvider;
      model?: string;
    }
  ): Promise<void> => {
    const tools = options?.useTools !== false ? getToolDefinitions() : [];

    if (tools.length > 0) {
      await generateWithTools(
        prompt,
        tools,
        handleToolCall,
        onChunk,
        {
          provider: options?.provider || provider,
          model: options?.model,
          maxToolCalls: options?.maxToolCalls,
          systemPrompt: options?.systemPrompt,
        }
      );
    } else {
      await generateTextStream(
        prompt,
        onChunk,
        {
          provider: options?.provider || provider,
          model: options?.model,
          systemPrompt: options?.systemPrompt,
        }
      );
    }
  }, [getToolDefinitions, handleToolCall, provider]);

  // Generate text with MCP tools (returns full response)
  const generateText = useCallback(async (
    prompt: string,
    options?: {
      maxToolCalls?: number;
      systemPrompt?: string;
      useTools?: boolean;
      provider?: AIProvider;
      model?: string;
    }
  ): Promise<string> => {
    const tools = options?.useTools !== false ? getToolDefinitions() : [];

    return generateTextWithTools(
      prompt,
      tools,
      handleToolCall,
      {
        provider: options?.provider || provider,
        model: options?.model,
        maxToolCalls: options?.maxToolCalls,
        systemPrompt: options?.systemPrompt,
      }
    );
  }, [getToolDefinitions, handleToolCall, provider]);

  // Change provider and save to localStorage
  const changeProvider = useCallback((newProvider: AIProvider) => {
    setProvider(newProvider);
    localStorage.setItem('ai-provider', newProvider);
  }, []);

  return {
    // MCP state
    connected: mcp.connected,
    connecting: mcp.connecting,
    servers: mcp.servers,
    tools: mcp.tools,
    toolCount: mcp.tools.length,

    // AI generation with tools
    generate,
    generateText,

    // Provider management
    provider,
    changeProvider,

    // Direct MCP access
    mcp,
  };
}
