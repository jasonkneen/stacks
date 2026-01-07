import React, { memo, useState, useRef, useCallback } from 'react';
import { SpatialItem } from '../types';
import { StickyComponent } from './StickyComponent';
import { NoteComponent } from './NoteComponent';
import { MediaComponent } from './MediaComponent';
import { FolderComponent } from './FolderComponent';
import { Plus } from 'lucide-react';

type HandlePosition = 'top' | 'right' | 'bottom' | 'left';

interface ItemRendererProps {
  item: SpatialItem;
  isSelected: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  dragTilt?: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, id: string) => void;
  onNavigate: (spaceId: string) => void;
  onOpenMedia: (item: SpatialItem, rect: DOMRect) => void;
  onOpenNote: (item: SpatialItem, rect: DOMRect) => void;
  onUpdateContent: (content: string) => void;
  onEditFolderName: (item: SpatialItem) => void;
  getSpaceItems: (spaceId: string) => SpatialItem[];
  onHover: (id: string | null) => void;
  onConnectStart?: (e: React.MouseEvent, id: string) => void;
  onAIPromptStart: (e: React.MouseEvent, itemId: string, position: { x: number; y: number }) => void;
  isHighlighted?: boolean;
  zoom?: number;
  contentZoom?: number;
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
  onOpenNote,
  onUpdateContent,
  onEditFolderName,
  getSpaceItems,
  onHover,
  onConnectStart,
  onAIPromptStart,
  isHighlighted = false,
  zoom = 1,
  contentZoom = 1
}) => {
  const [activeHandle, setActiveHandle] = useState<HandlePosition>('right');
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate which handle is closest to cursor position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate relative position from center
    const relX = e.clientX - centerX;
    const relY = e.clientY - centerY;

    // Determine which edge is closest based on position
    // Use angle to determine quadrant
    const angle = Math.atan2(relY, relX) * (180 / Math.PI);

    // Angle ranges: right (-45 to 45), bottom (45 to 135), left (135 to 180 or -180 to -135), top (-135 to -45)
    let newHandle: HandlePosition = 'right';
    if (angle >= -45 && angle < 45) {
      newHandle = 'right';
    } else if (angle >= 45 && angle < 135) {
      newHandle = 'bottom';
    } else if (angle >= 135 || angle < -135) {
      newHandle = 'left';
    } else if (angle >= -135 && angle < -45) {
      newHandle = 'top';
    }

    setActiveHandle(newHandle);
  }, []);
  
  // Dynamic Transition: NONE during drag/resize to prevent lag
  const isInteracting = isDragging || isResizing;
  const isGenerating = item.metadata?.isGenerating;

  const commonClasses = `absolute will-change-transform group/item ${
    isInteracting
      ? 'shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] z-[100] transition-none'
      : `transition-shadow duration-300 ${
          isHighlighted
            ? 'ring-4 ring-green-500/60 shadow-2xl z-50 animate-pulse'
            : isSelected
              ? 'ring-4 ring-blue-500/50 shadow-2xl z-50'
              : 'shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]'
        }`
  } ${isGenerating ? 'generating-glow' : ''}`;

  // Calculate final transform
  // 1. Base rotation (random scatter)
  // 2. Drag tilt (physics)
  // 3. Scale (pop on lift)
  const rotation = item.rotation + (isDragging ? dragTilt : 0);
  const scale = isDragging ? 1.05 : (isSelected ? 1.02 : 1);

  const style: React.CSSProperties = {
    transform: `translate3d(${item.x}px, ${item.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
    width: item.w,
    height: item.h,
    zIndex: isDragging ? 9999 : item.zIndex,
    willChange: isInteracting ? 'transform' : 'auto',
  };

  const renderContent = () => {
    switch (item.type) {
      case 'sticky':
        return <StickyComponent item={item} onChange={onUpdateContent} contentZoom={contentZoom} />;
      case 'note':
        return <NoteComponent item={item} onChange={onUpdateContent} onOpenNote={(rect) => onOpenNote(item, rect)} contentZoom={contentZoom} />;
      case 'image':
      case 'video':
        return <MediaComponent item={item} onDoubleClick={(rect) => onOpenMedia(item, rect)} />;
      case 'folder':
        return (
          <FolderComponent
            item={item}
            onDoubleClick={() => item.linkedSpaceId && onNavigate(item.linkedSpaceId)}
            onEditName={() => onEditFolderName(item)}
            getSpaceItems={getSpaceItems}
            zoom={zoom}
          />
        );
      default:
        return null;
    }
  };

  const isFolder = item.type === 'folder';

  return (
    <div
      ref={containerRef}
      data-item-id={item.id}
      className={`${commonClasses} rounded-3xl select-none`}
      style={{...style, background: 'transparent', overflow: 'visible'}}
      onMouseDown={onMouseDown}
      onMouseEnter={() => {
        setIsHovered(true);
        setActiveHandle('right'); // Always default to right
        onHover(item.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveHandle('right'); // Reset to right on leave
        onHover(null);
      }}
      onMouseMove={handleMouseMove}
    >
      <div className={`w-full h-full rounded-3xl ${isFolder ? 'overflow-visible' : 'overflow-hidden bg-white border border-gray-100'}`}>
          {renderContent()}
      </div>

      {/* Connection Handle - Drag to connect, Click for AI prompt */}
      {!isDragging && !isResizing && onConnectStart && isHovered && (
          <>
            {/* Top */}
            <div
              className={`absolute z-[60] transition-opacity duration-150 ${activeHandle === 'top' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{
                top: `${-3 / zoom}px`,
                left: '50%',
                transform: `translateX(-50%) scale(${1 / zoom})`,
                transformOrigin: 'center'
              }}
            >
              <div
                className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/50 transition-all cursor-pointer shadow-lg hover:scale-110 flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as any)._mouseDownPos = { x: e.clientX, y: e.clientY };
                  onConnectStart(e, item.id);
                }}
                onMouseUp={(e) => {
                  const startPos = (e.currentTarget as any)._mouseDownPos;
                  if (startPos) {
                    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
                    if (dist < 5) {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onAIPromptStart(e, item.id, { x: rect.left + rect.width / 2, y: rect.top });
                    }
                  }
                  delete (e.currentTarget as any)._mouseDownPos;
                }}
              >
                <Plus size={14} className="text-gray-800 pointer-events-none" />
              </div>
            </div>

            {/* Right */}
            <div
              className={`absolute z-[60] transition-opacity duration-150 ${activeHandle === 'right' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{
                top: '50%',
                right: `${-3 / zoom}px`,
                transform: `translateY(-50%) scale(${1 / zoom})`,
                transformOrigin: 'center'
              }}
            >
              <div
                className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/50 transition-all cursor-pointer shadow-lg hover:scale-110 flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as any)._mouseDownPos = { x: e.clientX, y: e.clientY };
                  onConnectStart(e, item.id);
                }}
                onMouseUp={(e) => {
                  const startPos = (e.currentTarget as any)._mouseDownPos;
                  if (startPos) {
                    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
                    if (dist < 5) {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onAIPromptStart(e, item.id, { x: rect.right, y: rect.top + rect.height / 2 });
                    }
                  }
                  delete (e.currentTarget as any)._mouseDownPos;
                }}
              >
                <Plus size={14} className="text-gray-800 pointer-events-none" />
              </div>
            </div>

            {/* Bottom */}
            <div
              className={`absolute z-[60] transition-opacity duration-150 ${activeHandle === 'bottom' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{
                bottom: `${-3 / zoom}px`,
                left: '50%',
                transform: `translateX(-50%) scale(${1 / zoom})`,
                transformOrigin: 'center'
              }}
            >
              <div
                className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/50 transition-all cursor-pointer shadow-lg hover:scale-110 flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as any)._mouseDownPos = { x: e.clientX, y: e.clientY };
                  onConnectStart(e, item.id);
                }}
                onMouseUp={(e) => {
                  const startPos = (e.currentTarget as any)._mouseDownPos;
                  if (startPos) {
                    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
                    if (dist < 5) {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onAIPromptStart(e, item.id, { x: rect.left + rect.width / 2, y: rect.bottom });
                    }
                  }
                  delete (e.currentTarget as any)._mouseDownPos;
                }}
              >
                <Plus size={14} className="text-gray-800 pointer-events-none" />
              </div>
            </div>

            {/* Left */}
            <div
              className={`absolute z-[60] transition-opacity duration-150 ${activeHandle === 'left' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{
                top: '50%',
                left: `${-3 / zoom}px`,
                transform: `translateY(-50%) scale(${1 / zoom})`,
                transformOrigin: 'center'
              }}
            >
              <div
                className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/50 transition-all cursor-pointer shadow-lg hover:scale-110 flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as any)._mouseDownPos = { x: e.clientX, y: e.clientY };
                  onConnectStart(e, item.id);
                }}
                onMouseUp={(e) => {
                  const startPos = (e.currentTarget as any)._mouseDownPos;
                  if (startPos) {
                    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
                    if (dist < 5) {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onAIPromptStart(e, item.id, { x: rect.left, y: rect.top + rect.height / 2 });
                    }
                  }
                  delete (e.currentTarget as any)._mouseDownPos;
                }}
              >
                <Plus size={14} className="text-gray-800 pointer-events-none" />
              </div>
            </div>
          </>
      )}

      {/* Resize Handle - Bottom Right Corner */}
      {!isDragging && onResizeStart && (
        <div
          className="absolute z-[70] opacity-0 group-hover/item:opacity-100 transition-opacity cursor-se-resize"
          style={{
            bottom: 0,
            right: 0,
            width: `${24 / zoom}px`,
            height: `${24 / zoom}px`
          }}
          onMouseDown={(e) => onResizeStart(e, item.id)}
        >
          {/* Subtle corner indicator */}
          <div
            className="absolute border-r-2 border-b-2 border-gray-400/50 rounded-br-sm"
            style={{
              bottom: `${4 / zoom}px`,
              right: `${4 / zoom}px`,
              width: `${8 / zoom}px`,
              height: `${8 / zoom}px`
            }}
          />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Optimized comparison - only re-render if these specific props change
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.isResizing !== next.isResizing) return false;
  if (prev.dragTilt !== next.dragTilt) return false;
  if (prev.zoom !== next.zoom) return false;
  if (prev.isHighlighted !== next.isHighlighted) return false;

  // Deep compare only necessary item properties
  const prevItem = prev.item;
  const nextItem = next.item;

  return (
    prevItem.id === nextItem.id &&
    prevItem.x === nextItem.x &&
    prevItem.y === nextItem.y &&
    prevItem.w === nextItem.w &&
    prevItem.h === nextItem.h &&
    prevItem.rotation === nextItem.rotation &&
    prevItem.content === nextItem.content &&
    prevItem.color === nextItem.color &&
    prevItem.type === nextItem.type &&
    prevItem.zIndex === nextItem.zIndex &&
    prevItem.metadata?.isGenerating === nextItem.metadata?.isGenerating
  );
});