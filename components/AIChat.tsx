import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

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

interface Props {
  position: { x: number; y: number };
  placeholder?: string;
  contextPrompt?: string;
  onSubmit: (prompt: string, response: AIResponse) => void;
  onClose: () => void;
  onGenerate?: (prompt: string) => Promise<AIResponse>;
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

export const AIChat: React.FC<Props> = ({
  position,
  placeholder = "Ask AI...",
  contextPrompt,
  onSubmit,
  onClose,
  onGenerate
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      if (onGenerate) {
        // Use provided generate function
        const response = await onGenerate(prompt);
        onSubmit(prompt, response);
      } else {
        // Mock response for testing
        const mockResponse = `[NOTE:AI Response]\n<p>${prompt}</p>\n[/NOTE]`;
        const parsed = parseAIResponse(mockResponse);
        if (parsed.length > 0) {
          onSubmit(prompt, parsed[0]);
        }
      }
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150]"
        onClick={() => !isGenerating && onClose()}
      />

      {/* Popup */}
      <div
        className="fixed z-[160] animate-in fade-in zoom-in-95 duration-200"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%) translateY(-16px)'
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-full flex items-center gap-3 px-5 py-3 shadow-lg min-w-[400px]">
            <Sparkles size={18} className="text-gray-700 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 outline-none text-sm"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="p-2 rounded-full bg-gray-800/10 hover:bg-gray-800/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Loader2 size={18} className="text-gray-800 animate-spin" />
              ) : (
                <Send size={18} className="text-gray-800" />
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-gray-600 text-xs flex items-center gap-2 bg-white/40 backdrop-blur-md px-3 py-1 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </div>
          )}
        </form>
      </div>
    </>
  );
};
