import { AIProvider } from './aiProvider';

export interface ImageGenerationOptions {
  resolution?: '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
  style?: 'natural' | 'vivid';
  provider?: AIProvider;
  sourceImage?: string; // Base64 data URL for image-to-image transformation
}

// Generate image using the appropriate provider
export const generateImage = async (
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> => {
  const provider = options?.provider || (localStorage.getItem('ai-provider') as AIProvider) || 'google';

  switch (provider) {
    case 'openai':
      return generateImageOpenAI(prompt, options);
    case 'google':
    default:
      return generateImageGemini(prompt, options);
  }
};

// Generate image using OpenAI gpt-image-1.5
const generateImageOpenAI = async (
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> => {
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add your API key in Settings → Providers.');
  }

  const model = localStorage.getItem('image-generation-model') || 'gpt-image-1.5';
  const [width, height] = (options?.resolution || '1024x1024').split('x').map(Number);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: options?.resolution || '1024x1024',
      quality: options?.style === 'vivid' ? 'hd' : 'standard',
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Image generation failed');
  }

  const data = await response.json();
  const base64 = data.data[0].b64_json;
  return `data:image/png;base64,${base64}`;
};

// Generate image using Gemini (Nano Banana)
const generateImageGemini = async (
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> => {
  const apiKey = localStorage.getItem('gemini-api-key');
  if (!apiKey) {
    throw new Error('Google AI API key not configured. Please add your API key in Settings → Providers.');
  }

  // Get model from settings
  const model = localStorage.getItem('image-generation-model') || 'gemini-2.5-flash-image';

  // Map resolution to aspectRatio and imageSize
  let aspectRatio = '1:1';
  let imageSize = '1K';

  if (options?.resolution === '1024x1792') {
    aspectRatio = '9:16';
    imageSize = '1K';
  } else if (options?.resolution === '1792x1024') {
    aspectRatio = '16:9';
    imageSize = '1K';
  } else if (options?.resolution === '512x512') {
    aspectRatio = '1:1';
    imageSize = '1K';
  }

  // Build request parts array - text prompt first, then optional source image
  const requestParts: any[] = [{ text: prompt }];

  // Add source image for image-to-image transformation
  if (options?.sourceImage) {
    // Extract mime type and base64 data from data URL
    const match = options.sourceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const [, mimeType, base64Data] = match;
      console.log('[imageGeneration] Image-to-image mode, source mime:', mimeType, 'size:', base64Data.length);

      // For image editing, add image BEFORE text prompt and make prompt explicit
      requestParts.unshift({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });

      // Enhance prompt to be explicit about generating a new image
      requestParts[1] = { text: `Using this image as reference, generate a new image that: ${prompt}. Output the result as an image.` };
    }
  }

  const requestBody = {
    contents: [{
      parts: requestParts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(aspectRatio !== '1:1' && {
        imageConfig: {
          aspectRatio,
          imageSize
        }
      })
    }
  };

  console.log('[imageGeneration] Request:', { model, prompt: prompt.slice(0, 100), requestBody });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('[imageGeneration] Full API error response:', JSON.stringify(error, null, 2));
    throw new Error(error.error?.message || JSON.stringify(error));
  }

  const data = await response.json();
  console.log('[imageGeneration] Full response:', JSON.stringify(data, null, 2).slice(0, 2000));
  console.log('[imageGeneration] Response summary:', {
    hasCandidates: !!data.candidates,
    candidateCount: data.candidates?.length,
    finishReason: data.candidates?.[0]?.finishReason,
    parts: data.candidates?.[0]?.content?.parts?.map((p: any) => ({
      type: p.text ? 'text' : p.inline_data ? 'image' : 'unknown',
      ...(p.text && { textPreview: p.text.slice(0, 100) }),
      ...(p.inline_data && { mime: p.inline_data.mime_type, dataLen: p.inline_data.data?.length })
    }))
  });

  // Extract image from response - API returns camelCase (inlineData) not snake_case
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) =>
    p.inlineData?.mimeType?.startsWith('image/') ||
    p.inline_data?.mime_type?.startsWith('image/')
  );

  if (imagePart) {
    // Handle both camelCase (inlineData) and snake_case (inline_data) responses
    const imageData = imagePart.inlineData || imagePart.inline_data;
    const mimeType = imageData.mimeType || imageData.mime_type;
    const base64 = imageData.data;
    console.log('[imageGeneration] Image found, mime:', mimeType, 'length:', base64.length);
    return `data:${mimeType};base64,${base64}`;
  }

  console.error('[imageGeneration] No image in response, parts:', parts);
  throw new Error('No image generated in response');
};
