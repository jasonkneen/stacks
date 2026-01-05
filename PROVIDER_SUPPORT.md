# AI Provider Support

This project now supports three AI providers using Vercel AI SDK v6:

## Supported Providers

1. **Anthropic (Claude)** - `@ai-sdk/anthropic`
   - Models: claude-sonnet-4-5-20250929, claude-opus-4-5-20251101, claude-haiku-4-5-20251015
   - Best for: General reasoning, tool use, vision

2. **OpenAI (GPT)** - `@ai-sdk/openai`
   - Models: gpt-4o, gpt-4o-mini, gpt-5.2, o3
   - Best for: Creative tasks, complex reasoning

3. **Google (Gemini)** - `@ai-sdk/google`
   - Models: gemini-2.0-flash-exp, gemini-3-flash, gemini-3-pro
   - Best for: Fast responses, vision, multimodal tasks

## Configuration

### Setting API Keys

1. Open Settings (gear icon)
2. Go to "Providers" tab
3. Enter your API keys:
   - Anthropic API Key: `sk-ant-...`
   - OpenAI API Key: `sk-...`
   - Google AI API Key: `AIza...`

Keys are stored securely in localStorage.

### Selecting Default Provider

1. Open Settings → "Models" tab
2. Select "Default AI Provider" dropdown
3. Choose: Anthropic, OpenAI, or Google

## Features

### Text Generation with MCP Tools
All three providers support:
- Streaming responses
- Tool calling (MCP server integration)
- Multi-turn conversations
- System prompts

### Vision Analysis
All three providers support image analysis:
- Image description generation
- Color extraction
- Works with any image URL

## Usage

### In Code

```typescript
import { useAIWithTools } from './hooks/useAIWithTools';

function MyComponent() {
  const ai = useAIWithTools();

  // Use current provider
  await ai.generate(prompt, (chunk) => console.log(chunk));

  // Override provider for specific request
  await ai.generate(prompt, onChunk, {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929'
  });

  // Change default provider
  ai.changeProvider('openai');
}
```

### Direct Provider Usage

```typescript
import { generateWithTools, getLanguageModel } from './utils/aiProvider';

// Get a model instance
const model = getLanguageModel({
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929'
});

// Generate with tools
await generateWithTools(prompt, tools, onToolCall, onChunk, {
  provider: 'anthropic',
  maxToolCalls: 10
});
```

## Architecture

### Files

- `utils/aiProvider.ts` - Unified provider interface using AI SDK
- `utils/visionAnalysis.ts` - Multi-provider vision analysis
- `utils/gemini.ts` - Legacy Gemini-specific code (deprecated)
- `hooks/useAIWithTools.ts` - React hook for AI + MCP integration

### Provider Selection

1. User selects provider in Settings
2. Saved to localStorage as `ai-provider`
3. `useAIWithTools` hook reads and uses selected provider
4. Can override per-request via options

## Testing

### Manual Testing

1. Configure API keys for all three providers
2. Select each provider in Settings → Models
3. Test text generation:
   - Type a prompt in chat
   - Verify streaming response works
4. Test vision:
   - Drop an image onto canvas
   - Verify image analysis works
5. Test MCP tools:
   - Connect MCP servers
   - Use prompts that trigger tools
   - Verify tool calls work

### Verification Checklist

- [x] AI SDK packages installed
- [x] Unified provider interface created
- [x] useAIWithTools updated for all providers
- [x] Settings modal has provider selector
- [x] Vision analysis supports all providers
- [x] Build succeeds with no errors
- [ ] Anthropic provider tested
- [ ] OpenAI provider tested
- [ ] Google provider tested

## Troubleshooting

### "API key not configured"
- Go to Settings → Providers
- Add the API key for the selected provider

### "Model not found"
- Check the model name matches the provider
- Anthropic: claude-*
- OpenAI: gpt-*, o3*
- Google: gemini-*

### Tool calls not working
- Verify MCP proxy is running: `npm run mcp:proxy`
- Check MCP servers are connected in Settings → MCP
- Ensure provider supports tool calling (all three do)

## Migration from Gemini-only

Previous code used `utils/gemini.ts` directly. Now:

```typescript
// Old
import { generateWithTools } from './utils/gemini';

// New
import { generateWithTools } from './utils/aiProvider';
// Add provider option
await generateWithTools(prompt, tools, onToolCall, onChunk, {
  provider: 'google' // or 'anthropic' or 'openai'
});
```

## Next Steps

- [ ] Test all three providers with real API keys
- [ ] Add model selection per provider
- [ ] Add usage tracking/costs per provider
- [ ] Implement fallback provider logic
- [ ] Add streaming optimization
