import { streamText, generateText, LanguageModel, tool } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Types for MCP tool integration
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  serverId: string;
}

export interface ToolCallHandler {
  (serverId: string, toolName: string, args: Record<string, any>): Promise<any>;
}

export type AIProvider = 'anthropic' | 'openai' | 'google';

// Provider configuration
interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  apiKey?: string;
}

// Get API key from localStorage or environment
const getApiKey = (provider: AIProvider): string => {
  const keyMap = {
    anthropic: 'anthropic-api-key',
    openai: 'openai-api-key',
    google: 'gemini-api-key',
  };

  const keyName = keyMap[provider];
  const stored = localStorage.getItem(keyName);

  if (stored) return stored;

  // Fallback to environment variables
  const envMap = {
    anthropic: (import.meta as any).env?.VITE_ANTHROPIC_API_KEY,
    openai: (import.meta as any).env?.VITE_OPENAI_API_KEY,
    google: (import.meta as any).env?.VITE_GEMINI_API_KEY,
  };

  return envMap[provider] || '';
};

// Get language model instance
export const getLanguageModel = (config: ProviderConfig): LanguageModel => {
  const apiKey = config.apiKey || getApiKey(config.provider);

  if (!apiKey) {
    throw new Error(`${config.provider} API key not configured. Please add your API key in Settings → Providers.`);
  }

  const savedModel = localStorage.getItem('text-model');

  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model || savedModel || 'claude-sonnet-4-5-20250929', { apiKey });

    case 'openai':
      return openai(config.model || savedModel || 'gpt-4o', { apiKey });

    case 'google': {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      return googleProvider(config.model || savedModel || 'gemini-2.0-flash-exp');
    }

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
};

// Convert JSON Schema to Zod schema (simplified)
const jsonSchemaToZod = (schema: any): z.ZodTypeAny => {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    const prop = value as any;
    if (prop.type === 'string') {
      shape[key] = z.string().describe(prop.description || key);
    } else if (prop.type === 'number' || prop.type === 'integer') {
      shape[key] = z.number().describe(prop.description || key);
    } else if (prop.type === 'boolean') {
      shape[key] = z.boolean().describe(prop.description || key);
    } else {
      shape[key] = z.any().describe(prop.description || key);
    }
  }

  return z.object(shape);
};

// Generate text with streaming and tool support
export const generateWithTools = async (
  prompt: string,
  tools: MCPToolDefinition[],
  onToolCall: ToolCallHandler,
  onChunk: (text: string) => void,
  options?: {
    provider?: AIProvider;
    model?: string;
    maxToolCalls?: number;
    systemPrompt?: string;
  }
): Promise<void> => {
  const provider = options?.provider || 'google';
  const model = getLanguageModel({ provider, model: options?.model });

  // Convert MCP tools to AI SDK tools
  const aiTools: Record<string, any> = {};
  tools.forEach(mcpTool => {
    const toolName = `${mcpTool.serverId}__${mcpTool.name}`.replace(/-/g, '_');
    aiTools[toolName] = {
      description: mcpTool.description || mcpTool.name,
      parameters: jsonSchemaToZod(mcpTool.inputSchema),
      execute: async (args: Record<string, any>) => {
        const result = await onToolCall(mcpTool.serverId, mcpTool.name, args);
        return typeof result === 'string' ? result : JSON.stringify(result);
      },
    };
  });

  const result = await streamText({
    model,
    system: options?.systemPrompt,
    prompt,
    tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
    maxSteps: options?.maxToolCalls || 10,
  });

  // Stream the text chunks
  for await (const chunk of result.textStream) {
    onChunk(chunk);
  }
};

// Generate text with tools (non-streaming)
export const generateTextWithTools = async (
  prompt: string,
  tools: MCPToolDefinition[],
  onToolCall: ToolCallHandler,
  options?: {
    provider?: AIProvider;
    model?: string;
    maxToolCalls?: number;
    systemPrompt?: string;
  }
): Promise<string> => {
  let result = '';
  await generateWithTools(
    prompt,
    tools,
    onToolCall,
    (chunk) => { result += chunk; },
    options
  );
  return result;
};

// Simple streaming generation without tools
export const generateTextStream = async (
  prompt: string,
  onChunk: (text: string) => void,
  options?: {
    provider?: AIProvider;
    model?: string;
    systemPrompt?: string;
  }
): Promise<void> => {
  const provider = options?.provider || 'google';
  const model = getLanguageModel({ provider, model: options?.model });

  const result = await streamText({
    model,
    system: options?.systemPrompt,
    prompt,
  });

  for await (const chunk of result.textStream) {
    onChunk(chunk);
  }
};
