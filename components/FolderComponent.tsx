import React, { useMemo } from 'react';
import { SpatialItem } from '../types';
import { Folder as FolderIcon } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onDoubleClick: () => void;
  getSpaceItems: (spaceId: string) => SpatialItem[];
}

export const FolderComponent: React.FC<Props> = ({ item, onDoubleClick, getSpaceItems }) => {
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
            <div className="w-full h-full bg-blue-50/50 backdrop-blur-xl border border-blue-100/50 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-blue-100/60 transition-colors shadow-sm">
                <div className="p-4 bg-white rounded-full shadow-sm text-blue-500">
                    <FolderIcon size={32} strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-blue-900/70 px-4 text-center truncate w-full">
                    {item.content}
                </span>
            </div>
        )}

        {/* Stack State */}
        {!isEmpty && (
            <>
                {/* We render items in reverse order (bottom up) so DOM layering is correct */}
                {/* 
                   linkedItems is [Smallest, Medium, Largest]
                   reversed is [Largest, Medium, Smallest]
                   
                   Iteration 1: Largest (Back)
                   Iteration 2: Medium
                   Iteration 3: Smallest (Front)
                */}
                {[...linkedItems].reverse().map((subItem, revIndex) => {
                    const index = linkedItems.length - 1 - revIndex; // Restore original index (0 = Smallest/Top)
                    
                    // Resting State styles
                    let restingClass = "";
                    let hoverClass = "";
                    
                    if (index === 0) {
                        // Top Item (Smallest)
                        restingClass = "rotate-0 scale-100 translate-y-0 z-30";
                        hoverClass = "group-hover:-translate-y-6 group-hover:scale-105 group-hover:shadow-2xl";
                    } else if (index === 1) {
                        // Second Item
                        restingClass = "-rotate-3 scale-[0.96] translate-y-0 z-20 brightness-95";
                        hoverClass = "group-hover:-translate-x-14 group-hover:-translate-y-2 group-hover:-rotate-12 group-hover:scale-100 group-hover:brightness-100 group-hover:shadow-xl";
                    } else {
                        // Third Item (Largest)
                        restingClass = "rotate-3 scale-[0.92] translate-y-0 z-10 brightness-90";
                        hoverClass = "group-hover:translate-x-14 group-hover:-translate-y-2 group-hover:rotate-12 group-hover:scale-100 group-hover:brightness-100 group-hover:shadow-xl";
                    }

                    return (
                        <div 
                            key={subItem.id}
                            className={`
                                absolute inset-0 bg-white border border-gray-200/80 shadow-md rounded-3xl overflow-hidden 
                                transition-all duration-500 cubic-bezier(0.19, 1, 0.22, 1) will-change-transform
                                ${restingClass} ${hoverClass}
                            `}
                        >
                            {renderPreview(subItem)}
                            
                            {/* Gloss for depth */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent pointer-events-none mix-blend-multiply" />
                        </div>
                    );
                })}

                {/* Label Badge - Floating below */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-100 z-40">
                    <div className="bg-gray-900/80 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full shadow-xl">
                        <span className="text-xs font-bold text-white whitespace-nowrap">
                            {item.content}
                            <span className="opacity-50 font-normal ml-2">{linkedItems.length} items</span>
                        </span>
                    </div>
                </div>
            </>
        )}
    </div>
  );
};

// Helper to render mini-previews of items
const renderPreview = (item: SpatialItem) => {
    switch (item.type) {
        case 'image':
            return <img src={item.content} className="w-full h-full object-cover" alt="preview" draggable={false}/>;
        case 'video':
            return (
                <div className="w-full h-full relative bg-gray-900">
                     <video src={item.content} className="w-full h-full object-cover opacity-90" muted />
                     <div className="absolute inset-0 flex items-center justify-center opacity-50">
                        <div className="w-8 h-8 rounded-full bg-white/20" />
                     </div>
                </div>
            );
        case 'sticky':
            return (
                <div className="w-full h-full bg-yellow-200 p-4 relative">
                    <div className="text-[10px] leading-relaxed font-handwriting text-gray-800 opacity-80 line-clamp-6 select-none">
                        {item.content}
                    </div>
                </div>
            );
        case 'note':
            return (
                <div className="w-full h-full bg-white p-5 flex flex-col gap-3">
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
                 <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                     <FolderIcon size={40} className="text-blue-200" />
                 </div>
             );
        default:
            return <div className="w-full h-full bg-gray-50" />;
    }
};