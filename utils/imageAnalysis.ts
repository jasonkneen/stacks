// Image analysis utility - extracts colors and generates description

export interface ImageAnalysis {
  description: string;
  colors: string[]; // hex colors
  isAnalyzing?: boolean;
}

// Extract dominant colors from an image using canvas
export const extractColors = async (imageUrl: string, numColors: number = 6): Promise<string[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    // Don't set crossOrigin for data URLs
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      console.log('[extractColors] Image loaded, extracting colors...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([]);
        return;
      }

      // Sample at smaller size for performance
      const sampleSize = 100;
      canvas.width = sampleSize;
      canvas.height = sampleSize;

      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const pixels = imageData.data;

      // Simple color quantization - collect colors and find most common
      const colorCounts: Record<string, number> = {};

      for (let i = 0; i < pixels.length; i += 4) {
        // Quantize to reduce color space (round to nearest 32)
        const r = Math.round(pixels[i] / 32) * 32;
        const g = Math.round(pixels[i + 1] / 32) * 32;
        const b = Math.round(pixels[i + 2] / 32) * 32;

        const hex = rgbToHex(r, g, b);
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      // Sort by frequency and get top colors
      const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, numColors * 2) // Get more than needed
        .map(([hex]) => hex);

      // Filter out colors that are too similar
      const distinctColors: string[] = [];
      for (const color of sortedColors) {
        if (distinctColors.length >= numColors) break;

        const isDifferent = distinctColors.every(existing =>
          colorDistance(color, existing) > 50
        );

        if (isDifferent) {
          distinctColors.push(color);
        }
      }

      console.log('[extractColors] Extracted colors:', distinctColors);
      resolve(distinctColors);
    };

    img.onerror = (err) => {
      console.error('[extractColors] Image load failed:', err);
      resolve([]);
    };
    img.src = imageUrl;
  });
};

// Generate a description based on colors and basic analysis
export const generateDescription = async (imageUrl: string, colors: string[]): Promise<string> => {
  // Analyze color mood
  const mood = analyzeMood(colors);
  const dominantColor = colors[0] ? getColorName(colors[0]) : 'neutral';

  // Simple descriptions based on color analysis
  const descriptions = [
    `A ${mood} image with predominantly ${dominantColor} tones`,
    `${mood.charAt(0).toUpperCase() + mood.slice(1)} composition featuring ${dominantColor} as the dominant color`,
    `Image with ${colors.length} distinct colors, primarily ${dominantColor}`,
  ];

  // In a real implementation, this would call an AI API
  // For now, return a color-based description
  return descriptions[Math.floor(Math.random() * descriptions.length)];
};

// Full analysis function with multi-provider vision
export const analyzeImage = async (imageUrl: string): Promise<ImageAnalysis> => {
  try {
    // Try vision API first (supports Anthropic, OpenAI, Google)
    const { analyzeImageWithVision } = await import('./visionAnalysis');
    const result = await analyzeImageWithVision(imageUrl);

    return {
      description: result.description,
      colors: result.colors,
      isAnalyzing: false
    };
  } catch (error) {
    console.error('Vision API analysis failed, using fallback:', error);

    // Fallback to local analysis
    try {
      const colors = await extractColors(imageUrl);
      const description = await generateDescription(imageUrl, colors);

      return {
        description,
        colors,
        isAnalyzing: false
      };
    } catch (fallbackError) {
      console.error('Fallback analysis failed:', fallbackError);
      return {
        description: 'Unable to analyze image',
        colors: [],
        isAnalyzing: false
      };
    }
  }
};

// Helper functions
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const colorDistance = (hex1: string, hex2: string): number => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 0;

  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

const analyzeMood = (colors: string[]): string => {
  if (colors.length === 0) return 'neutral';

  let totalBrightness = 0;
  let totalSaturation = 0;

  for (const hex of colors) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;

    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    totalBrightness += brightness;
    totalSaturation += saturation;
  }

  const avgBrightness = totalBrightness / colors.length;
  const avgSaturation = totalSaturation / colors.length;

  if (avgBrightness > 180 && avgSaturation < 0.3) return 'bright and airy';
  if (avgBrightness < 80) return 'dark and moody';
  if (avgSaturation > 0.6) return 'vibrant and colorful';
  if (avgSaturation < 0.2) return 'muted and subtle';
  return 'balanced';
};

const getColorName = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'unknown';

  const { r, g, b } = rgb;

  // Simple color naming based on RGB values
  if (r > 200 && g < 100 && b < 100) return 'red';
  if (r < 100 && g > 200 && b < 100) return 'green';
  if (r < 100 && g < 100 && b > 200) return 'blue';
  if (r > 200 && g > 200 && b < 100) return 'yellow';
  if (r > 200 && g < 100 && b > 200) return 'magenta';
  if (r < 100 && g > 200 && b > 200) return 'cyan';
  if (r > 200 && g > 150 && b < 100) return 'orange';
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 50 && g < 50 && b < 50) return 'black';
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) return 'gray';
  if (r > g && r > b) return 'warm';
  if (b > r && b > g) return 'cool';

  return 'mixed';
};
