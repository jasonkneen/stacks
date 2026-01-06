import React, { useEffect, useState, useRef } from 'react';
import { SpatialItem } from '../types';
import { X, Loader2, Sparkles, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { isMediaId, getMediaURL, getMediaMetadata } from '../lib/mediaStorage';
import { generateImage } from '../utils/imageGeneration';

interface Variant {
  url: string;
  prompt?: string;
  isOriginal?: boolean;
}

interface Props {
  item: SpatialItem;
  sourceRect: DOMRect | null;
  onClose: () => void;
  onCreateVariant: (originalItem: SpatialItem, variantUrl: string, prompt: string) => void;
  onCloseWithVariants?: (originalItem: SpatialItem, variants: Variant[]) => void;
  onAnalyze?: (itemId: string, imageUrl: string) => void;
}

export const MediaViewer: React.FC<Props> = ({ item, sourceRect, onClose, onCreateVariant, onCloseWithVariants, onAnalyze }) => {
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(item.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Variant navigation state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // IndexedDB metadata (merged with item.metadata)
  const [dbMetadata, setDbMetadata] = useState<Record<string, unknown> | null>(null);

  // Initialize variants with original image and fetch IndexedDB metadata
  useEffect(() => {
    const initVariants = async () => {
      let originalUrl = item.content;
      if (isMediaId(item.content)) {
        const url = await getMediaURL(item.content);
        if (url) originalUrl = url;
        // Fetch metadata from IndexedDB
        const meta = await getMediaMetadata(item.content);
        if (meta) setDbMetadata(meta);
      }
      setVariants([{ url: originalUrl, isOriginal: true }]);
      setResolvedSrc(originalUrl);
    };
    initVariants();
  }, [item.content]);

  // Get current displayed image
  const currentVariant = variants[currentIndex] || variants[0];

  // Resolve media ID to object URL if needed (for original only, variants are already URLs)
  useEffect(() => {
    if (currentVariant?.url) {
      if (isMediaId(currentVariant.url)) {
        getMediaURL(currentVariant.url).then(url => {
          if (url) setResolvedSrc(url);
        });
      } else {
        setResolvedSrc(currentVariant.url);
      }
      // Reset loaded state when changing variants
      if (!currentVariant.isOriginal) {
        setLoaded(false);
      }
    }
  }, [currentVariant]);

  // Get analysis data from metadata
  const description = item.metadata?.description as string | undefined;
  const colors = (item.metadata?.colors as string[]) || [];
  const isAnalyzing = item.metadata?.isAnalyzing as boolean | undefined;

  // Trigger analysis if no data and it's an image
  useEffect(() => {
    if (item.type === 'image' && !isAnalyzing && colors.length === 0 && onAnalyze) {
      console.log('[MediaViewer] Triggering analysis for image:', item.id);
      onAnalyze(item.id, item.content);
    }
  }, [item.id, item.type, item.content, isAnalyzing, colors.length, onAnalyze]);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) handleClose();
      if (e.key === 'ArrowLeft' && variants.length > 1) {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight' && variants.length > 1) {
        setCurrentIndex(prev => Math.min(variants.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isGenerating, variants.length]);

  const handleClose = () => {
    setIsClosing(true);

    // If we have multiple variants, trigger stack creation
    if (variants.length > 1 && onCloseWithVariants) {
      setTimeout(() => onCloseWithVariants(item, variants), 350);
    } else {
      setTimeout(() => onClose(), 350);
    }
  };

  // Convert object URL or any image URL to base64 data URL
  const convertToBase64 = async (url: string): Promise<string> => {
    // Already a data URL
    if (url.startsWith('data:')) return url;

    // Fetch and convert to base64
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      // Get selected provider from settings
      const selectedProvider = (localStorage.getItem('ai-provider') || 'google') as 'openai' | 'google';

      // Convert current image to base64 for the AI model
      const base64Image = await convertToBase64(resolvedSrc);
      console.log('[MediaViewer] Converted image to base64, length:', base64Image.length);

      // Generate new image variant using AI
      const variantUrl = await generateImage(prompt, {
        sourceImage: base64Image,
        provider: selectedProvider
      });

      // Add to variants array
      const newVariant: Variant = { url: variantUrl, prompt };
      setVariants(prev => [...prev, newVariant]);

      // Navigate to the new variant
      setCurrentIndex(variants.length);

      setPrompt('');
    } catch (error) {
      console.error('[MediaViewer] Generation failed:', error);
      // TODO: Show error to user
    } finally {
      setIsGenerating(false);
    }
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
          {(item.metadata?.filename || dbMetadata?.filename || dbMetadata?.originalName) && (
            <span className="max-w-xs truncate">{(item.metadata?.filename || dbMetadata?.filename || dbMetadata?.originalName) as string}</span>
          )}
          {(item.metadata?.size || dbMetadata?.size) && <span>SIZE {(item.metadata?.size || dbMetadata?.size) as string}</span>}
          {(item.metadata?.dimensions || dbMetadata?.dimensions) && <span>DIM {(item.metadata?.dimensions || dbMetadata?.dimensions) as string}</span>}
          {(item.metadata?.format || dbMetadata?.format) && <span>FORMAT {(item.metadata?.format || dbMetadata?.format) as string}</span>}
          {(item.metadata?.dateTaken || dbMetadata?.dateTaken) && <span>DATE {(item.metadata?.dateTaken || dbMetadata?.dateTaken) as string}</span>}
          {(item.metadata?.duration || dbMetadata?.duration) && <span>DUR {(item.metadata?.duration || dbMetadata?.duration) as string}</span>}
          {(item.metadata?.fps || dbMetadata?.fps) && <span>FPS {(item.metadata?.fps || dbMetadata?.fps) as string}</span>}
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
            src={resolvedSrc}
            alt="Fullscreen"
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <video
            src={resolvedSrc}
            controls
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onCanPlay={() => setLoaded(true)}
          />
        )}

        {/* Variant Navigation - Left/Right Buttons */}
        {variants.length > 1 && !showAtSource && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="text-white" />
              </button>
            )}
            {currentIndex < variants.length - 1 && (
              <button
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              >
                <ChevronRight size={24} className="text-white" />
              </button>
            )}
          </>
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

      {/* Variant Indicator - Below Image */}
      {variants.length > 1 && !showAtSource && (
        <div
          className="fixed z-[115] transition-all duration-300"
          style={{
            left: target.x + target.w / 2,
            top: target.y + target.h + 16,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2">
            {/* Dots indicator */}
            <div className="flex items-center gap-1.5">
              {variants.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`transition-all duration-200 rounded-full ${
                    idx === currentIndex
                      ? 'w-6 h-2 bg-white'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            {/* Count indicator */}
            <span className="text-white/70 text-xs font-mono">
              {currentIndex + 1} of {variants.length}
            </span>
          </div>
          {/* Current variant prompt */}
          {currentVariant?.prompt && (
            <p className="text-white/50 text-xs text-center mt-2 max-w-xs">
              "{currentVariant.prompt}"
            </p>
          )}
        </div>
      )}

      {/* AI Chat Input */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 transition-all duration-300 ${
          isAnimating || isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* Description */}
        {item.type === 'image' && currentIndex === 0 && (
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
