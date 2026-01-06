import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Sparkles, ChevronDown, Image as ImageIcon, FileText, StickyNote, X } from 'lucide-react';

export type AIResponseFormat = 'text' | 'sticky' | 'note' | 'image' | 'document';

export interface AIResponse {
  content: string;
  format: AIResponseFormat;
  metadata?: {
    title?: string;
    color?: string;
    imageUrl?: string;
  };
}

export interface AIOptions {
  outputType?: 'auto' | 'sticky' | 'note' | 'image';
  imageResolution?: '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
  imageStyle?: 'natural' | 'vivid';
}

interface Props {
  position: { x: number; y: number };
  placeholder?: string;
  contextPrompt?: string;
  onSubmit: (prompt: string, options?: AIOptions) => void;
  onClose: () => void;
  initialExpanded?: boolean;
  targetNodeLabel?: string; // Label for @ chip showing routing destination
  onTargetNodeClick?: () => void; // Called when @ chip is clicked
  disableBackdropClose?: boolean; // Disable closing via backdrop (use blank canvas click instead)
}

// System prompt for the AI to understand output formats
export const AI_FORMAT_SYSTEM_PROMPT = `You are a creative assistant that can generate content in multiple formats.

When responding, you MUST format your output using one of these patterns:

1. STICKY NOTE (for brief thoughts, reminders, quotes):
   [STICKY:color]
   Content here (1-3 sentences max)
   [/STICKY]

   Available colors: yellow, blue, green, pink, orange, white

2. DOCUMENT/NOTE (for detailed content, lists, explanations):
   [NOTE:title]
   <p>Content with HTML formatting</p>
   <ul><li>Lists</li></ul>
   [/NOTE]

3. IMAGE (if generating or requesting an image):
   [IMAGE]
   Image description or URL
   [/IMAGE]

4. TEXT (default - for simple responses):
   Just respond normally

Examples:
- "give me 5 ideas" → Return 5 sticky notes with [STICKY:yellow]...[/STICKY]
- "explain this concept" → Return [NOTE:Explanation]...[/NOTE]
- "create inspiration board" → Return multiple [STICKY] items
- "summarize this" → Return [NOTE:Summary]...[/NOTE]

Always choose the most appropriate format for the content.`;

// Parse multiple formatted responses from AI output
export const parseAIResponse = (rawResponse: string): AIResponse[] => {
  const responses: AIResponse[] = [];

  // Extract all STICKY tags
  const stickyMatches = rawResponse.match(/\[STICKY:\w+\][\s\S]*?\[\/STICKY\]/g);
  if (stickyMatches) {
    stickyMatches.forEach(match => {
      const colorMatch = match.match(/\[STICKY:(\w+)\]([\s\S]*?)\[\/STICKY\]/);
      if (colorMatch) {
        responses.push({
          format: 'sticky',
          content: colorMatch[2].trim(),
          metadata: { color: `bg-${colorMatch[1]}-200` }
        });
      }
    });
  }

  // Extract all NOTE tags
  const noteMatches = rawResponse.match(/\[NOTE:[^\]]+\][\s\S]*?\[\/NOTE\]/g);
  if (noteMatches) {
    noteMatches.forEach(match => {
      const titleMatch = match.match(/\[NOTE:([^\]]+)\]([\s\S]*?)\[\/NOTE\]/);
      if (titleMatch) {
        responses.push({
          format: 'note',
          content: titleMatch[2].trim(),
          metadata: { title: titleMatch[1] }
        });
      }
    });
  }

  // Extract all IMAGE tags
  const imageMatches = rawResponse.match(/\[IMAGE\][\s\S]*?\[\/IMAGE\]/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const contentMatch = match.match(/\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/);
      if (contentMatch) {
        responses.push({
          format: 'image',
          content: contentMatch[1].trim()
        });
      }
    });
  }

  // If no formatted responses found, return as single text response
  if (responses.length === 0) {
    responses.push({
      format: 'text',
      content: rawResponse.trim()
    });
  }

  return responses;
};

// Detect if prompt is image-related
const detectImagePrompt = (prompt: string): boolean => {
  const imageKeywords = [
    'generate image', 'create image', 'make image', 'draw', 'paint',
    'generate a picture', 'create a picture', 'make a picture',
    'generate an image', 'create an image', 'make an image',
    'image of', 'picture of', 'illustration of', 'photo of',
    'visualize', 'render', 'design a', 'sketch',
    // Image transformation keywords
    'color this', 'colour this', 'colorize', 'colourize', 'add color', 'add colour',
    'fill in', 'color in', 'colour in', 'make it colorful', 'make it colourful',
    'transform this', 'edit this image', 'modify this image', 'change this image',
    'stylize', 'restyle', 'reimagine', 'recreate'
  ];
  const lowerPrompt = prompt.toLowerCase();
  return imageKeywords.some(kw => lowerPrompt.includes(kw));
};

// Detect if prompt is asking for ideas/brainstorming
const detectBrainstormPrompt = (prompt: string): boolean => {
  const keywords = [
    'ideas', 'brainstorm', 'suggest', 'give me', 'list of',
    'options for', 'alternatives', 'inspiration'
  ];
  const lowerPrompt = prompt.toLowerCase();
  return keywords.some(kw => lowerPrompt.includes(kw));
};

export const AIChat: React.FC<Props> = ({
  position,
  placeholder = "Ask AI...",
  onSubmit,
  onClose,
  initialExpanded = false,
  targetNodeLabel,
  onTargetNodeClick,
  disableBackdropClose = false
}) => {
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [options, setOptions] = useState<AIOptions>({
    outputType: 'auto',
    imageResolution: '1024x1024',
    imageStyle: 'natural'
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Smart classification with scoring
  const detectedType = useMemo(() => {
    if (!prompt.trim()) return 'auto';

    const text = prompt;
    const chars = text.length;
    const lines = text.split(/\r?\n/).length;

    // Hard lock: image patterns
    const imagePatterns = [
      /!\[[^\]]*]\([^)]*\)/,
      /<img\b[^>]*>/i,
      /\bdata:image\//i,
      /\b(?:image|draw|paint|generate.*image|create.*image|make.*image)\b/i,
      /\b(?:color|colour|fill in|colorize|color this|colour this)\b/i,
      /\b(?:photo|picture|illustration|render|visualize)\b/i
    ];
    if (imagePatterns.some(re => re.test(text))) return 'image';

    // Count structural elements
    const headings = (text.match(/^#{1,6}\s+/gm) || []).length;
    const bullets = (text.match(/^\s*[-*]\s+/gm) || []).length;
    const separators = (text.match(/^---\s*$/gm) || []).length;
    const paras = (text.match(/\n{2,}/g) || []).length;

    // Scoring
    let scoreSticky = 0, scoreNote = 0;

    // Sticky: short, simple
    if (chars < 300) scoreSticky += 3;
    if (lines <= 5) scoreSticky += 2;
    if (headings <= 1) scoreSticky += 1;
    if (/^\s*(?:todo|remember|note|idea|reminder)\b/i.test(text)) scoreSticky += 3;
    if (/^\s*[-*]\s*\[[ x]\]\s+/m.test(text)) scoreSticky += 2; // checkboxes

    // Note: structured, moderate length
    if (chars >= 200 && chars <= 4000) scoreNote += 2;
    if (headings >= 1) scoreNote += 2;
    if (bullets >= 2) scoreNote += 1;
    if (paras >= 1) scoreNote += 2;
    if (/^\s*(?:Summary|Overview|Context|Background|Details|Plan)\s*:/mi.test(text)) scoreNote += 2;

    return scoreSticky > scoreNote ? 'sticky' : 'note';
  }, [prompt]);

  // Auto-expand when user starts typing
  useEffect(() => {
    if (prompt.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [prompt, isExpanded]);

  // Auto-select output type based on detection (only if user hasn't manually changed it)
  useEffect(() => {
    if (detectedType !== 'auto' && options.outputType === 'auto') {
      setOptions(prev => ({ ...prev, outputType: detectedType }));
    }
  }, [detectedType, options.outputType]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      console.log('[AIChat] Empty prompt, not submitting');
      return;
    }
    console.log('[AIChat] Submitting:', { prompt, options, detectedType });
    onSubmit(prompt, { ...options, outputType: detectedType !== 'auto' ? detectedType : options.outputType });
  };

  const outputTypeIcons = {
    auto: <Sparkles size={14} />,
    sticky: <StickyNote size={14} />,
    note: <FileText size={14} />,
    image: <ImageIcon size={14} />
  };

  return (
    <>
      {/* Backdrop - only close if enabled */}
      {!disableBackdropClose && (
        <div
          className="fixed inset-0 z-[150]"
          onClick={onClose}
        />
      )}

      {/* Popup */}
      <div
        className="fixed z-[160] animate-in fade-in zoom-in-95 duration-200"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%) translateY(-16px)'
        }}
      >
        <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl overflow-hidden min-w-[420px]">
          {/* Target Node Chip */}
          {targetNodeLabel && (
            <div className="px-4 pt-3 pb-2 border-b border-gray-200/50">
              <button
                type="button"
                onClick={onTargetNodeClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors"
              >
                <span>@</span>
                <span>{targetNodeLabel}</span>
                <X size={12} className="ml-0.5" />
              </button>
            </div>
          )}

          {/* Main Input Row */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 px-4 py-3">
              <Sparkles size={18} className="text-gray-600 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 outline-none text-sm"
              />

              {/* Expand/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-gray-200 text-gray-700' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="submit"
                disabled={!prompt.trim()}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          </form>

          {/* Expanded Options Panel */}
          {isExpanded && (
            <div className="border-t border-gray-200/50 px-4 py-3 bg-gray-50/50">
              {/* Output Type Selector */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-gray-500 w-16">Output:</span>
                <div className="flex gap-1">
                  {(['auto', 'sticky', 'note', 'image'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setOptions(o => ({ ...o, outputType: type }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        (detectedType !== 'auto' ? detectedType : options.outputType) === type
                          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {outputTypeIcons[type]}
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image-specific options */}
              {(detectedType === 'image' || options.outputType === 'image') && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-16">Size:</span>
                    <div className="flex gap-1">
                      {(['512x512', '1024x1024', '1024x1792', '1792x1024'] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setOptions(o => ({ ...o, imageResolution: res }))}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                            options.imageResolution === res
                              ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {res === '1024x1792' ? 'Portrait' : res === '1792x1024' ? 'Landscape' : res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-16">Style:</span>
                    <div className="flex gap-1">
                      {(['natural', 'vivid'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setOptions(o => ({ ...o, imageStyle: style }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            options.imageStyle === style
                              ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Detected prompt hint */}
              {detectedType !== 'auto' && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                  {outputTypeIcons[detectedType]}
                  <span>Detected: {detectedType} generation</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
