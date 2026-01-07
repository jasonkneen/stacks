import React, { useMemo, memo, useState, useEffect } from 'react';
import { SpatialItem } from '../types';
import { Folder as FolderIcon } from 'lucide-react';
import { isMediaId, getMediaURL } from '../lib/mediaStorage';

// Small component to handle media URL resolution for previews
const MediaPreview: React.FC<{ src: string; type: 'image' | 'video' }> = memo(({ src, type }) => {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    if (isMediaId(src)) {
      getMediaURL(src).then(url => {
        if (url) setResolvedSrc(url);
      });
    } else {
      setResolvedSrc(src);
    }
  }, [src]);

  if (type === 'image') {
    return <img src={resolvedSrc} className="w-full h-full object-cover" alt="preview" draggable={false} />;
  }

  return (
    <div className="w-full h-full relative bg-gray-900">
      <video src={resolvedSrc} className="w-full h-full object-cover opacity-90" muted />
      <div className="absolute inset-0 flex items-center justify-center opacity-50">
        <div className="w-8 h-8 rounded-full bg-white/20" />
      </div>
    </div>
  );
});

interface Props {
  item: SpatialItem;
  onDoubleClick: () => void;
  onEditName: () => void;
  getSpaceItems: (spaceId: string) => SpatialItem[];
  zoom?: number;
}

export const FolderComponent: React.FC<Props> = memo(({ item, onDoubleClick, onEditName, getSpaceItems, zoom = 1 }) => {
  const linkedItems = useMemo(() => {
    if (!item.linkedSpaceId) return [];
    const items = getSpaceItems(item.linkedSpaceId);
    
    // 1. Get top 3 items by Z-index (most relevant/recent items)
    const topItems = [...items].sort((a, b) => b.zIndex - a.zIndex).slice(0, 3);
    
    // 2. Sort by Area Ascending (Smallest first)
    // Smallest will be at index 0
    // Largest will be at index 2
    // We render reversed, so Largest is rendered first (Background), Smallest rendered last (Foreground)
    return topItems.sort((a, b) => (a.w * a.h) - (b.w * b.h));
  }, [item.linkedSpaceId, getSpaceItems]);

  const isEmpty = linkedItems.length === 0;

  return (
    <div
        className="w-full h-full relative group cursor-pointer"
        onDoubleClick={onDoubleClick}
    >
        {/* Empty State */}
        {isEmpty && (
            <div className="w-full h-full bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-gray-200/60 transition-colors shadow-sm">
                <div className="p-4 bg-white rounded-full shadow-sm text-gray-500">
                    <FolderIcon size={32} strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-gray-700 px-4 text-center truncate w-full">
                    {item.content}
                </span>
            </div>
        )}

        {/* Stack State - Full size background cards, small square note on top */}
        {!isEmpty && (
            <>
                {/* Background cards - full size, fanned out */}
                {[...linkedItems].reverse().map((subItem, revIndex) => {
                    const index = linkedItems.length - 1 - revIndex;
                    const isTopCard = index === 0;

                    // Skip top card here - render it separately
                    if (isTopCard) return null;

                    let restingClass = "";
                    if (index === 1) {
                        restingClass = "-rotate-6 scale-[0.96] z-20 brightness-95";
                    } else {
                        restingClass = "rotate-6 scale-[0.92] z-10 brightness-90";
                    }

                    return (
                        <div
                            key={subItem.id}
                            className={`absolute inset-0 shadow-md rounded-3xl overflow-hidden transition-all duration-500 will-change-transform ${restingClass}`}
                        >
                            {renderPreview(subItem)}
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent pointer-events-none mix-blend-multiply" />
                        </div>
                    );
                })}

                {/* Top card - small square note */}
                {linkedItems[0] && (
                    <div
                        className="absolute shadow-xl rounded-2xl overflow-hidden z-30"
                        style={{
                            width: 100,
                            height: 100,
                            right: -10,
                            bottom: -10,
                            transform: 'rotate(3deg)',
                        }}
                    >
                        {renderPreview(linkedItems[0])}
                    </div>
                )}

                {/* Label Badge - Floating below, counter-scaled to stay constant size */}
                <div
                    className="absolute -bottom-[50px] left-1/2 z-40 cursor-pointer"
                    style={{
                        transform: `translateX(-50%) scale(${1 / zoom})`,
                        transformOrigin: 'center top'
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onEditName();
                    }}
                >
                    <div className="bg-white/40 backdrop-blur-md border border-white/60 px-3 py-1 rounded-full shadow-xl hover:bg-white/50 transition-colors">
                        <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                            {linkedItems.length} items
                        </span>
                    </div>
                </div>
            </>
        )}
    </div>
  );
});

// Helper to render mini-previews of items
const renderPreview = (item: SpatialItem) => {
    switch (item.type) {
        case 'image':
            return <MediaPreview src={item.content} type="image" />;
        case 'video':
            return <MediaPreview src={item.content} type="video" />;
        case 'sticky':
            return (
                <div className={`w-full h-full ${item.color || 'bg-yellow-200'} p-4 relative`}>
                    <div className="text-[10px] leading-relaxed font-handwriting text-gray-800 opacity-80 line-clamp-6 select-none">
                        {item.content}
                    </div>
                </div>
            );
        case 'note':
            return (
                <div className="w-full h-full bg-white/90 backdrop-blur-sm p-5 flex flex-col gap-3">
                    <div className="w-3/4 h-2.5 bg-gray-800 rounded-sm opacity-10" />
                    <div className="space-y-1.5 mt-1">
                        <div className="w-full h-1.5 bg-gray-400 rounded-sm opacity-20" />
                        <div className="w-full h-1.5 bg-gray-400 rounded-sm opacity-20" />
                        <div className="w-5/6 h-1.5 bg-gray-400 rounded-sm opacity-20" />
                    </div>
                </div>
            );
        case 'folder':
             return (
                 <div className="w-full h-full bg-blue-100/30 backdrop-blur-sm flex items-center justify-center">
                     <FolderIcon size={40} className="text-blue-300" />
                 </div>
             );
        default:
            return <div className="w-full h-full bg-gray-100/30 backdrop-blur-sm" />;
    }
};