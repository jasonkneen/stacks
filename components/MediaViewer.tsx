import React, { useEffect, useState, useRef } from 'react';
import { SpatialItem } from '../types';
import { X, Loader2, Sparkles, Send } from 'lucide-react';

interface Props {
  item: SpatialItem;
  sourceRect: DOMRect | null;
  onClose: () => void;
  onCreateVariant: (originalItem: SpatialItem, variantUrl: string, prompt: string) => void;
  onAnalyze?: (itemId: string, imageUrl: string) => void;
}

export const MediaViewer: React.FC<Props> = ({ item, sourceRect, onClose, onCreateVariant, onAnalyze }) => {
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Get analysis data from metadata
  const description = item.metadata?.description as string | undefined;
  const colors = (item.metadata?.colors as string[]) || [];
  const isAnalyzing = item.metadata?.isAnalyzing as boolean | undefined;

  // Trigger analysis if no data and it's an image
  useEffect(() => {
    if (item.type === 'image' && !description && !isAnalyzing && colors.length === 0 && onAnalyze) {
      onAnalyze(item.id, item.content);
    }
  }, [item.id, item.type, item.content, description, isAnalyzing, colors.length, onAnalyze]);

  // Calculate target position (centered)
  const getTargetRect = () => {
    const maxW = window.innerWidth * 0.8;
    const maxH = window.innerHeight * 0.7;
    const aspectRatio = sourceRect ? sourceRect.width / sourceRect.height : 16 / 9;

    let w = maxW;
    let h = w / aspectRatio;

    if (h > maxH) {
      h = maxH;
      w = h * aspectRatio;
    }

    return {
      x: (window.innerWidth - w) / 2,
      y: (window.innerHeight - h) / 2 - 40,
      w,
      h
    };
  };

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Focus input after animation
  useEffect(() => {
    if (!isAnimating) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAnimating]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isGenerating]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    setTimeout(() => {
      const variantUrl = `https://picsum.photos/800/600?random=${Date.now()}`;
      onCreateVariant(item, variantUrl, prompt);
      setPrompt('');
      setIsGenerating(false);
    }, 2000);
  };

  const target = getTargetRect();
  const source = sourceRect || { x: target.x, y: target.y, width: target.w, height: target.h };

  // Determine current animation state
  const showAtSource = isAnimating || isClosing;

  const mediaStyle: React.CSSProperties = showAtSource
    ? {
        position: 'fixed',
        left: source.x,
        top: source.y,
        width: source.width,
        height: source.height,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 110,
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }
    : {
        position: 'fixed',
        left: target.x,
        top: target.y,
        width: target.w,
        height: target.h,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 110,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-all duration-300 ${
        isClosing ? 'bg-black/0' : 'bg-black/90'
      } ${isAnimating ? 'bg-black/0' : ''}`}
      style={{ backdropFilter: isClosing || isAnimating ? 'blur(0px)' : 'blur(8px)' }}
    >
      {/* Header */}
      <div
        className={`absolute top-0 w-full p-6 flex justify-between items-start text-white/70 z-10 transition-opacity duration-300 ${
          isAnimating || isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          disabled={isGenerating}
        >
          <X size={24} />
        </button>
        <div className="flex flex-col items-end gap-1 font-mono text-xs">
          {item.metadata?.filename && <span className="max-w-xs truncate">{item.metadata.filename as string}</span>}
          {item.metadata?.size && <span>SIZE {item.metadata.size}</span>}
          {item.metadata?.dimensions && <span>DIM {item.metadata.dimensions as string}</span>}
          {item.metadata?.format && <span>FORMAT {item.metadata.format as string}</span>}
          {item.metadata?.dateTaken && <span>DATE {item.metadata.dateTaken as string}</span>}
          {item.metadata?.duration && <span>DUR {item.metadata.duration as string}</span>}
          {item.metadata?.fps && <span>FPS {item.metadata.fps}</span>}
        </div>
      </div>

      {/* Morphing Media */}
      <div ref={mediaRef} style={mediaStyle}>
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 animate-pulse bg-gray-900">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-sm mt-2">Loading...</span>
          </div>
        )}

        {item.type === 'image' ? (
          <img
            src={item.content}
            alt="Fullscreen"
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <video
            src={item.content}
            controls
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onCanPlay={() => setLoaded(true)}
          />
        )}

        </div>

      {/* Color Palette - Outside Left of Image */}
      {colors.length > 0 && !showAtSource && (
        <div
          className="fixed flex flex-col gap-2 z-[115] transition-all duration-300"
          style={{
            left: target.x - 60,
            top: target.y + (target.h / 2) - (colors.length * 22),
          }}
        >
          {colors.map((color, index) => (
            <div
              key={index}
              className="w-10 h-10 rounded-xl shadow-lg border-2 border-white/30 transition-all hover:scale-110 hover:border-white/60 cursor-pointer"
              style={{ backgroundColor: color }}
              title={`${color} - Click to copy`}
              onClick={() => navigator.clipboard.writeText(color)}
            />
          ))}
        </div>
      )}

      {/* AI Chat Input */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 transition-all duration-300 ${
          isAnimating || isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* Description */}
        {item.type === 'image' && (
          <div className="mb-4 text-center">
            {isAnalyzing ? (
              <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing image...</span>
              </div>
            ) : description ? (
              <p className="text-white/70 text-sm italic">{description}</p>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-3 px-5 py-3 shadow-2xl">
            <Sparkles size={18} className="text-white/50 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe changes... (e.g., 'make it warmer', 'add sunset colors')"
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <Send size={18} className="text-white" />
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white/60 text-xs flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Generating variant...
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
