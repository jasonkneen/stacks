import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface Props {
  position: { x: number; y: number };
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

export const AIPromptPopup: React.FC<Props> = ({ position, onSubmit, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (prompt.trim()) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <>
      {/* Backdrop - No blur */}
      <div
        className="fixed inset-0 z-[150]"
        onClick={onClose}
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
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3 px-5 py-3 shadow-2xl min-w-[400px]">
            <Sparkles size={18} className="text-white/70 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Expand on this and create 10 ideas..."
              className="flex-1 bg-transparent text-white placeholder-white/50 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
