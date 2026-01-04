import React, { useEffect, useState } from 'react';
import { SpatialItem } from '../types';
import { X, Info, Loader2 } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onClose: () => void;
}

export const MediaViewer: React.FC<Props> = ({ item, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-modal-enter">
      
      {/* Header */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-start text-white/70 z-10">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
        </button>
        <div className="flex flex-col items-end gap-1 font-mono text-xs">
            {item.metadata?.size && <span>SIZE {item.metadata.size}</span>}
            {item.metadata?.resolution && <span>RES {item.metadata.resolution}</span>}
            {item.metadata?.fps && <span>FPS {item.metadata.fps}</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-12 overflow-hidden relative">
        {!loaded && (
            <div className="absolute flex flex-col items-center gap-2 text-white/50 animate-pulse">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-sm">Loading media...</span>
            </div>
        )}

        {item.type === 'image' ? (
            <img 
                src={item.content} 
                alt="Fullscreen" 
                className={`max-w-full max-h-full object-contain shadow-2xl rounded-sm transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
            />
        ) : (
            <video 
                src={item.content} 
                controls 
                autoPlay 
                className={`max-w-full max-h-full shadow-2xl rounded-sm transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onCanPlay={() => setLoaded(true)}
            />
        )}
      </div>

      {/* Footer / Notes placeholder */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <button className="text-white/50 hover:text-white transition-colors text-sm flex items-center gap-2">
            <Info size={16} />
            Add a note...
        </button>
      </div>
    </div>
  );
};