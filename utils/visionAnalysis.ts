import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AIProvider } from './aiProvider';

export interface VisionAnalysis {
  description: string;
  colors: string[];
}

// Get API key for provider
const getApiKey = (provider: AIProvider): string => {
  const keyMap = {
    anthropic: 'anthropic-api-key',
    openai: 'openai-api-key',
    google: 'gemini-api-key',
  };

  const stored = localStorage.getItem(keyMap[provider]);
  if (stored) return stored;

  const envMap = {
    anthropic: (import.meta as any).env?.VITE_ANTHROPIC_API_KEY,
    openai: (import.meta as any).env?.VITE_OPENAI_API_KEY,
    google: (import.meta as any).env?.VITE_GEMINI_API_KEY,
  };

  return envMap[provider] || '';
};

// Convert image URL to base64
const imageUrlToBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const [, data] = result.split(',');
      resolve({
        data,
        mimeType: blob.type
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Analyze image using vision models
export const analyzeImageWithVision = async (
  imageUrl: string,
  options?: {
    provider?: AIProvider;
    model?: string;
  }
): Promise<VisionAnalysis> => {
  const provider = options?.provider || (localStorage.getItem('ai-provider') as AIProvider) || 'google';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    throw new Error(`${provider} API key not configured. Please add your API key in Settings → Providers.`);
  }

  // Convert image to base64
  const { data, mimeType } = await imageUrlToBase64(imageUrl);

  // Select model based on provider
  const savedModel = localStorage.getItem('image-analysis-model');
  let model;
  switch (provider) {
    case 'anthropic':
      model = anthropic(options?.model || savedModel || 'claude-sonnet-4-5-20250929', { apiKey });
      break;
    case 'openai':
      model = openai(options?.model || savedModel || 'gpt-4o', { apiKey });
      break;
    case 'google': {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      model = googleProvider(options?.model || savedModel || 'gemini-2.0-flash-exp');
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const result = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: `data:${mimeType};base64,${data}`,
          },
          {
            type: 'text',
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
