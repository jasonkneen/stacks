import { GoogleGenAI, Type } from '@google/genai';

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

// Initialize Gemini client
let genAI: GoogleGenAI | null = null;

export const initGemini = (apiKey: string) => {
  genAI = new GoogleGenAI({ apiKey });
};

// Get API key from localStorage or environment
const getApiKey = (): string => {
  const stored = localStorage.getItem('gemini-api-key');
  if (stored) return stored;

  // Fallback to environment variable if available
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

// Initialize on import if key exists
const apiKey = getApiKey();
if (apiKey) {
  initGemini(apiKey);
}

// Convert MCP tool schema to Gemini function declaration
const mcpToolToGeminiFunction = (tool: MCPToolDefinition) => {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (tool.inputSchema?.properties) {
    for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
      const prop = value as any;
      properties[key] = {
        type: mapJsonSchemaType(prop.type),
        description: prop.description || key,
      };
      if (prop.enum) {
        properties[key].enum = prop.enum;
      }
    }
  }

  if (tool.inputSchema?.required) {
    required.push(...tool.inputSchema.required);
  }

  return {
    name: `${tool.serverId}__${tool.name}`.replace(/-/g, '_'),
    description: tool.description || tool.name,
    parameters: {
      type: Type.OBJECT,
      properties,
      required,
    },
  };
};

// Map JSON Schema types to Gemini types
const mapJsonSchemaType = (jsonType: string): Type => {
  switch (jsonType) {
    case 'string': return Type.STRING;
    case 'number': return Type.NUMBER;
    case 'integer': return Type.INTEGER;
    case 'boolean': return Type.BOOLEAN;
    case 'array': return Type.ARRAY;
    case 'object': return Type.OBJECT;
    default: return Type.STRING;
  }
};

// Generate text using Gemini Flash with callback streaming
export const generateTextStream = async (prompt: string, onChunk: (text: string) => void): Promise<void> => {
  const key = getApiKey();
  if (!key) {
    throw new Error('Gemini API key not configured. Please add your API key in Settings → Providers.');
  }

  if (!genAI) {
    initGemini(key);
  }

  const model = localStorage.getItem('text-model') || 'gemini-2.0-flash-exp';
  const response = await genAI!.models.generateContentStream({
    model,
    contents: prompt
  });

  for await (const chunk of response) {
    onChunk(chunk.text);
  }
};

// Generate text with MCP tool support
export const generateWithTools = async (
  prompt: string,
  tools: MCPToolDefinition[],
  onToolCall: ToolCallHandler,
  onChunk: (text: string) => void,
  options?: {
    maxToolCalls?: number;
    systemPrompt?: string;
  }
): Promise<void> => {
  const key = getApiKey();
  if (!key) {
    throw new Error('Gemini API key not configured. Please add your API key in Settings → Providers.');
  }

  if (!genAI) {
    initGemini(key);
  }

  const maxToolCalls = options?.maxToolCalls ?? 10;
  let toolCallCount = 0;

  // Convert MCP tools to Gemini function declarations
  const functionDeclarations = tools.map(mcpToolToGeminiFunction);

  // Build conversation history
  const contents: any[] = [];

  // Add system prompt if provided
  if (options?.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System: ${options.systemPrompt}\n\nUser: ${prompt}` }]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  // Tool calling loop
  const model = localStorage.getItem('text-model') || 'gemini-2.0-flash-exp';
  while (toolCallCount < maxToolCalls) {
    const response = await genAI!.models.generateContent({
      model,
      contents,
      config: {
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) break;

    const parts = candidate.content?.parts || [];

    // Check for function calls
    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length === 0) {
      // No function calls, extract text and stream it
      const textParts = parts.filter((p: any) => p.text);
      for (const part of textParts) {
        onChunk(part.text);
      }
      break;
    }

    // Process function calls
    const functionResponses: any[] = [];

    for (const part of functionCalls) {
      const call = part.functionCall;
      toolCallCount++;

      // Parse server ID and tool name from the function name
      const [serverId, ...toolNameParts] = call.name.split('__');
      const toolName = toolNameParts.join('__').replace(/_/g, '-');

      try {
        // Call the MCP tool
        const result = await onToolCall(
          serverId.replace(/_/g, '-'),
          toolName,
          call.args || {}
        );

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: {
              result: typeof result === 'string' ? result : JSON.stringify(result)
            }
          }
        });
      } catch (error) {
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: {
              error: error instanceof Error ? error.message : 'Tool call failed'
            }
          }
        });
      }
    }

    // Add assistant response and tool results to conversation
    contents.push({
      role: 'model',
      parts: functionCalls
    });

    contents.push({
      role: 'user',
      parts: functionResponses
    });
  }
};

// Simpler version: generate with tools and return final text
export const generateTextWithTools = async (
  prompt: string,
  tools: MCPToolDefinition[],
  onToolCall: ToolCallHandler,
  options?: {
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

// Analyze image using Gemini Vision
export const analyzeImageWithGemini = async (imageUrl: string): Promise<{ description: string; colors: string[] }> => {
  const key = getApiKey();
  if (!key) {
    throw new Error('Gemini API key not configured. Please add your API key in Settings → Providers.');
  }

  if (!genAI) {
    initGemini(key);
  }

  // Fetch image as base64
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  const model = localStorage.getItem('image-analysis-model') || 'gemini-3-flash';
  const result = await genAI!.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64.split(',')[1],
              mimeType: blob.type
            }
          },
          {
            text: `Analyze this image and provide:
1. A one-sentence description of what you see
2. The 6 most dominant colors as hex codes

Format your response as JSON:
{
  "description": "Your one-sentence description",
  "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5", "#hex6"]
}`
          }
        ]
      }
    ]
  });

  const text = result.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  }

  // Fallback if parsing fails
  return {
    description: 'Unable to analyze image',
    colors: []
  };
};

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
