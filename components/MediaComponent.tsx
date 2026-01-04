import React, { useState } from 'react';
import { SpatialItem } from '../types';
import { Play } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onDoubleClick: () => void;
}

export const MediaComponent: React.FC<Props> = ({ item, onDoubleClick }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full h-full relative group bg-gray-900 flex items-center justify-center overflow-hidden" onDoubleClick={onDoubleClick}>
      
      {/* Loading Skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center z-10">
            {/* Optional Icon Placeholder */}
            <div className="w-8 h-8 rounded-full bg-gray-700/50" />
        </div>
      )}

      {item.type === 'image' ? (
        <img 
            src={item.content} 
            alt="media" 
            className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
            onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="w-full h-full relative overflow-hidden">
            <video 
                src={item.content} 
                className={`w-full h-full object-cover pointer-events-none opacity-80 transition-opacity duration-500 ${loaded ? 'opacity-80' : 'opacity-0'}`}
                muted
                loop
                onCanPlay={() => setLoaded(true)}
            />
             {loaded && (
                <div className="absolute inset-0 flex items-center justify-center animate-space-enter">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg group-hover:bg-white/40 transition-colors">
                        <Play fill="white" className="text-white ml-1" size={20} />
                    </div>
                </div>
             )}
        </div>
      )}
      
      {/* Metadata Overlay (Alpha Spec) */}
      {loaded && (
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-mono font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {item.metadata?.resolution} 
            {item.metadata?.size && ` • ${item.metadata.size}`}
            {item.metadata?.duration && ` • ${item.metadata.duration}`}
        </div>
      )}
    </div>
  );
};