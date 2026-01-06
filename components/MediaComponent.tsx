import React, { useState, useRef, memo, useEffect } from 'react';
import { SpatialItem } from '../types';
import { Play, Pause } from 'lucide-react';
import { isMediaId, getMediaURL } from '../lib/mediaStorage';

interface Props {
  item: SpatialItem;
  onDoubleClick: (rect: DOMRect) => void;
}

export const MediaComponent: React.FC<Props> = memo(({ item, onDoubleClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>(item.content);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Resolve media ID to object URL if needed
  useEffect(() => {
    if (isMediaId(item.content)) {
      getMediaURL(item.content).then(url => {
        if (url) setResolvedSrc(url);
      });
    } else {
      setResolvedSrc(item.content);
    }
  }, [item.content]);

  const handleDoubleClick = () => {
    if (containerRef.current) {
      onDoubleClick(containerRef.current.getBoundingClientRect());
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative group bg-gray-900 flex items-center justify-center overflow-hidden"
      onDoubleClick={handleDoubleClick}
    >
      
      {/* Loading Skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center z-10">
            {/* Optional Icon Placeholder */}
            <div className="w-8 h-8 rounded-full bg-gray-700/50" />
        </div>
      )}

      {item.type === 'image' ? (
        <img
            src={resolvedSrc}
            alt="media"
            className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="w-full h-full relative overflow-hidden">
            <video
                ref={videoRef}
                src={resolvedSrc}
                className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                muted
                preload="metadata"
                playsInline
                onCanPlay={() => setLoaded(true)}
                onEnded={() => setIsPlaying(false)}
            />
             {loaded && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                    <button
                      onClick={togglePlay}
                      className="w-14 h-14 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl hover:bg-white/50 hover:scale-110 transition-all cursor-pointer pointer-events-auto"
                    >
                        {isPlaying ? (
                          <Pause fill="white" className="text-white" size={24} />
                        ) : (
                          <Play fill="white" className="text-white ml-1" size={24} />
                        )}
                    </button>
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
}, (prev, next) => {
  // Only re-render if content or metadata changes
  return prev.item.content === next.item.content &&
         prev.item.metadata?.isAnalyzing === next.item.metadata?.isAnalyzing;
});