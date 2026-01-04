import React, { memo } from 'react';
import { SpatialItem } from '../types';
import { StickyComponent } from './StickyComponent';
import { NoteComponent } from './NoteComponent';
import { MediaComponent } from './MediaComponent';
import { FolderComponent } from './FolderComponent';

interface ItemRendererProps {
  item: SpatialItem;
  isSelected: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  dragTilt?: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, id: string) => void;
  onNavigate: (spaceId: string) => void;
  onOpenMedia: (item: SpatialItem, rect: DOMRect) => void;
  onUpdateContent: (content: string) => void;
  getSpaceItems: (spaceId: string) => SpatialItem[];
  onHover: (id: string | null) => void;
  onConnectStart: (e: React.MouseEvent, id: string) => void;
}

export const ItemRenderer: React.FC<ItemRendererProps> = memo(({
  item,
  isSelected,
  isDragging = false,
  isResizing = false,
  dragTilt = 0,
  onMouseDown,
  onResizeStart,
  onNavigate,
  onOpenMedia,
  onUpdateContent,
  getSpaceItems,
  onHover,
  onConnectStart
}) => {
  
  // Dynamic Transition: NONE during drag/resize to prevent lag
  const isInteracting = isDragging || isResizing;
  const commonClasses = `absolute will-change-transform group/item ${
    isInteracting
      ? 'shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] z-[100] transition-none'
      : `transition-shadow duration-300 ${isSelected ? 'ring-4 ring-blue-500/50 shadow-2xl z-50' : 'shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]'}`
  }`;

  // Calculate final transform
  // 1. Base rotation (random scatter)
  // 2. Drag tilt (physics)
  // 3. Scale (pop on lift)
  const rotation = item.rotation + (isDragging ? dragTilt : 0);
  const scale = isDragging ? 1.05 : (isSelected ? 1.02 : 1);

  const style: React.CSSProperties = {
    transform: `translate(${item.x}px, ${item.y}px) rotate(${rotation}deg) scale(${scale})`,
    width: item.w,
    height: item.h,
    zIndex: isDragging ? 9999 : item.zIndex, // Ensure dragged item is always on top visually
  };

  const renderContent = () => {
    switch (item.type) {
      case 'sticky':
        return <StickyComponent item={item} onChange={onUpdateContent} />;
      case 'note':
        return <NoteComponent item={item} onChange={onUpdateContent} />;
      case 'image':
      case 'video':
        return <MediaComponent item={item} onDoubleClick={(rect) => onOpenMedia(item, rect)} />;
      case 'folder':
        return <FolderComponent item={item} onDoubleClick={() => item.linkedSpaceId && onNavigate(item.linkedSpaceId)} getSpaceItems={getSpaceItems} />;
      default:
        return null;
    }
  };

  const isFolder = item.type === 'folder';

  return (
    <div 
      className={`${commonClasses} rounded-3xl overflow-visible select-none`}
      style={{...style, background: 'transparent'}} 
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={`w-full h-full rounded-3xl ${isFolder ? 'overflow-visible' : 'overflow-hidden bg-white'}`}>
          {renderContent()}
      </div>

      {/* Connection Handles (Visible on Group Hover) */}
      {!isDragging && !isResizing && (
          <>
            {/* Top */}
            <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-400 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-crosshair z-[60] shadow-sm hover:scale-125"
                onMouseDown={(e) => onConnectStart(e, item.id)}
            />
            {/* Right */}
            <div
                className="absolute top-1/2 -right-3 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-400 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-crosshair z-[60] shadow-sm hover:scale-125"
                onMouseDown={(e) => onConnectStart(e, item.id)}
            />
            {/* Bottom */}
            <div
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-400 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-crosshair z-[60] shadow-sm hover:scale-125"
                onMouseDown={(e) => onConnectStart(e, item.id)}
            />
            {/* Left */}
            <div
                className="absolute top-1/2 -left-3 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-400 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-crosshair z-[60] shadow-sm hover:scale-125"
                onMouseDown={(e) => onConnectStart(e, item.id)}
            />
          </>
      )}

      {/* Resize Handle - Bottom Right Corner */}
      {!isDragging && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-[70] opacity-0 group-hover/item:opacity-100 transition-opacity"
          onMouseDown={(e) => onResizeStart(e, item.id)}
        >
          {/* Subtle corner indicator */}
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400/50 rounded-br-sm" />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison for performance
  return (
    prev.item === next.item &&
    prev.isSelected === next.isSelected &&
    prev.isDragging === next.isDragging &&
    prev.isResizing === next.isResizing &&
    prev.dragTilt === next.dragTilt
  );
});