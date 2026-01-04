import React, { useEffect, useState, useRef } from 'react';
import { SpatialItem } from '../types';
import { X, Loader2, Sparkles, Send } from 'lucide-react';

interface Props {
  item: SpatialItem;
  sourceRect: DOMRect | null;
  onClose: () => void;
  onCreateVariant: (originalItem: SpatialItem, variantUrl: string, prompt: string) => void;
}

export const MediaViewer: React.FC<Props> = ({ item, sourceRect, onClose, onCreateVariant }) => {
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

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
          {item.metadata?.size && <span>SIZE {item.metadata.size}</span>}
          {item.metadata?.resolution && <span>RES {item.metadata.resolution}</span>}
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

      {/* AI Chat Input */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 transition-all duration-300 ${
          isAnimating || isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
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
