import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SpatialItem, Connection } from '../types';
import { ItemRenderer } from './ItemRenderer';

interface CanvasProps {
  items: SpatialItem[];
  connections: Connection[];
  initialCamera?: { x: number; y: number; zoom: number };
  cameraOverride?: { x: number; y: number; zoom: number; id: string }; // id acts as a trigger
  selection: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdateItems: (items: SpatialItem[]) => void;
  onNavigate: (spaceId: string) => void;
  onOpenMedia: (item: SpatialItem, rect: DOMRect) => void;
  onOpenNote: (item: SpatialItem, rect: DOMRect) => void;
  onEditFolderName: (item: SpatialItem) => void;
  getSpaceItems: (spaceId: string) => SpatialItem[];
  onStackItems: (sourceId: string, targetId: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onDropFiles: (files: File[], position: { x: number; y: number }) => void;
  onMarkManuallyPositioned: (ids: string[]) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  items,
  connections,
  initialCamera = { x: 0, y: 0, zoom: 1 },
  cameraOverride,
  selection,
  onSelectionChange,
  onUpdateItems,
  onNavigate,
  onOpenMedia,
  onOpenNote,
  onEditFolderName,
  getSpaceItems,
  onStackItems,
  onConnect,
  onDeleteConnection,
  onDropFiles,
  onMarkManuallyPositioned
}) => {
  // Camera State
  const [camera, setCamera] = useState(initialCamera);
  
  // Handle Camera Override (e.g. Auto Layout)
  useEffect(() => {
    if (cameraOverride) {
        setCamera({ x: cameraOverride.x, y: cameraOverride.y, zoom: cameraOverride.zoom });
        // Reset inertia when force moving
        velocityRef.current = { x: 0, y: 0 };
        cancelAnimationFrame(animationFrameRef.current);
    }
  }, [cameraOverride]);

  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef<{ w: number; h: number; mouseX: number; mouseY: number } | null>(null);
  
  // Panning & Selection Modes
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); // Screen coords for delta calc

  // Connection State
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [connectingLine, setConnectingLine] = useState<{ fromId: string, startX: number, startY: number, endX: number, endY: number } | null>(null);

  // Drag & Drop State
  const [isDragOver, setIsDragOver] = useState(false);

  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Physics State
  const [dragTilt, setDragTilt] = useState(0);
  
  // Inertia State
  const velocityRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    return {
      x: (screenX - centerX - camera.x) / camera.zoom,
      y: (screenY - centerY - camera.y) / camera.zoom
    };
  }, [camera]);

  // --- Keyboard (Space for Panning) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'TEXTAREA' && !(e.target as HTMLElement).isContentEditable) {
            setIsSpacePressed(true);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Zoom Logic (Scroll to Zoom, unless over scrollable element) ---
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check if target is inside a scrollable element
    let target = e.target as HTMLElement | null;
    while (target && target !== canvasRef.current) {
      const { overflowY, overflowX } = getComputedStyle(target);
      const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight;
      const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && target.scrollWidth > target.clientWidth;

      if (isScrollableY || isScrollableX) {
        // Let the element scroll naturally
        return;
      }
      target = target.parentElement;
    }

    e.preventDefault();

    // Zoom to cursor
    const zoomSensitivity = 0.003;
    const delta = -e.deltaY * zoomSensitivity;

    setCamera(prev => {
      const newZoom = Math.min(Math.max(prev.zoom + delta, 0.1), 5);

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const offsetBeforeX = prev.x;
      const offsetBeforeY = prev.y;

      const worldX = (mouseX - centerX - offsetBeforeX) / prev.zoom;
      const worldY = (mouseY - centerY - offsetBeforeY) / prev.zoom;

      const newX = mouseX - centerX - (worldX * newZoom);
      const newY = mouseY - centerY - (worldY * newZoom);

      return { x: newX, y: newY, zoom: newZoom };
    });
  }, []);

  // --- Inertia Loop ---
  const startInertia = () => {
    cancelAnimationFrame(animationFrameRef.current);
    
    const run = () => {
      const v = velocityRef.current;
      v.x *= 0.92; // Friction
      v.y *= 0.92;

      if (Math.abs(v.x) < 0.1 && Math.abs(v.y) < 0.1) {
        return; // Stop
      }

      setCamera(prev => ({
        ...prev,
        x: prev.x + v.x,
        y: prev.y + v.y
      }));

      animationFrameRef.current = requestAnimationFrame(run);
    };
    run();
  };

  // --- Event Listeners ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check for pan triggers: Middle Button (1) or Space Key
    const isPanTrigger = e.button === 1 || isSpacePressed;

    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'canvas-bg') {
        if (isPanTrigger) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            velocityRef.current = { x: 0, y: 0 };
            cancelAnimationFrame(animationFrameRef.current);
        } else if (e.button === 0) {
            // Left click on background -> Lasso Selection
            if (!e.shiftKey) {
                onSelectionChange(new Set());
            }
            const worldPos = screenToWorld(e.clientX, e.clientY);
            // Initialize 0-size box at click location
            setSelectionBox({ x: worldPos.x, y: worldPos.y, w: 0, h: 0 });
            setDragStartPos({ x: e.clientX, y: e.clientY });
        }
    }
  };

  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    
    // Bring to front
    const maxZ = Math.max(...items.map(i => i.zIndex), 0);
    const updatedItems = items.map(item => 
        item.id === itemId ? { ...item, zIndex: maxZ + 1 } : item
    );
    onUpdateItems(updatedItems);

    setDraggingId(itemId);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    setDragTilt(0);
    
    // Selection Logic
    if (e.shiftKey) {
        // Toggle selection
        const next = new Set(selection);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        onSelectionChange(next);
    } else if (!selection.has(itemId)) {
        // Exclusive selection
         onSelectionChange(new Set([itemId]));
    }
  };

  const handleConnectStart = (e: React.MouseEvent, fromId: string) => {
      e.stopPropagation();
      e.preventDefault();

      const worldPos = screenToWorld(e.clientX, e.clientY);
      setConnectingLine({
          fromId,
          startX: worldPos.x,
          startY: worldPos.y,
          endX: worldPos.x,
          endY: worldPos.y
      });
  };

  const handleResizeStart = (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      setResizingId(itemId);
      resizeStartRef.current = {
          w: item.w,
          h: item.h,
          mouseX: e.clientX,
          mouseY: e.clientY
      };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    setLastMousePos({ x: e.clientX, y: e.clientY });

    // Update velocity for inertia
    velocityRef.current = { x: deltaX, y: deltaY };

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Handle resize
    if (resizingId && resizeStartRef.current) {
        const startData = resizeStartRef.current;
        const deltaMouseX = e.clientX - startData.mouseX;
        const deltaMouseY = e.clientY - startData.mouseY;

        // Scale delta by zoom level
        const scaledDeltaX = deltaMouseX / camera.zoom;
        const scaledDeltaY = deltaMouseY / camera.zoom;

        const newW = Math.max(80, startData.w + scaledDeltaX);
        const newH = Math.max(80, startData.h + scaledDeltaY);

        const updatedItems = items.map(item =>
            item.id === resizingId ? { ...item, w: newW, h: newH } : item
        );
        onUpdateItems(updatedItems);
        return;
    }

    if (connectingLine) {
        setConnectingLine(prev => prev ? { ...prev, endX: worldPos.x, endY: worldPos.y } : null);
        return; // Consume event if connecting
    }

    if (isPanning) {
        setCamera(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
        return;
    }

    if (draggingId) {
        // Drag Item Logic
        const targetTilt = deltaX * 0.4;
        setDragTilt(Math.max(Math.min(targetTilt, 12), -12));

        const worldDeltaX = deltaX / camera.zoom;
        const worldDeltaY = deltaY / camera.zoom;

        const updatedItems = items.map(item => {
            if (item.id === draggingId || (selection.has(item.id) && selection.has(draggingId))) {
                return { ...item, x: item.x + worldDeltaX, y: item.y + worldDeltaY };
            }
            return item;
        });
        onUpdateItems(updatedItems);
    } else if (selectionBox) {
        // Lasso Selection Logic
        const currentWorldPos = worldPos;
        const startWorldPos = screenToWorld(dragStartPos.x, dragStartPos.y);

        const newBox = {
            x: Math.min(startWorldPos.x, currentWorldPos.x),
            y: Math.min(startWorldPos.y, currentWorldPos.y),
            w: Math.abs(currentWorldPos.x - startWorldPos.x),
            h: Math.abs(currentWorldPos.y - startWorldPos.y)
        };
        
        setSelectionBox(newBox);

        // Calculate intersections
        const newSelection = new Set<string>();
        
        items.forEach(item => {
            // Simple AABB intersection
            const isIntersecting = 
                item.x < newBox.x + newBox.w &&
                item.x + item.w > newBox.x &&
                item.y < newBox.y + newBox.h &&
                item.y + item.h > newBox.y;
            
            if (isIntersecting) {
                newSelection.add(item.id);
            }
        });

        onSelectionChange(newSelection);
    }
  }, [isPanning, draggingId, resizingId, selectionBox, lastMousePos, camera.zoom, items, selection, onUpdateItems, screenToWorld, dragStartPos, onSelectionChange, connectingLine]);

  const handleMouseUp = useCallback(() => {
    // Clear resize state
    if (resizingId) {
        setResizingId(null);
        resizeStartRef.current = null;
        return;
    }

    if (connectingLine) {
        // Check for connection drop
        if (hoveredItemId && hoveredItemId !== connectingLine.fromId) {
            onConnect(connectingLine.fromId, hoveredItemId);
        }
        setConnectingLine(null);
    }

    if (draggingId) {
        // Mark dragged items as manually positioned
        const draggedIds = selection.has(draggingId)
          ? Array.from(selection).filter(id => items.find(i => i.id === id))
          : [draggingId];
        onMarkManuallyPositioned(draggedIds);

        // --- STACKING DETECTION ---
        const draggedItem = items.find(i => i.id === draggingId);
        if (draggedItem) {
             const centerX = draggedItem.x + draggedItem.w / 2;
             const centerY = draggedItem.y + draggedItem.h / 2;

             for (const item of items) {
                 if (item.id === draggingId) continue;

                 // Check if center of dragged item is inside another item's bounding box
                 if (
                     centerX > item.x &&
                     centerX < item.x + item.w &&
                     centerY > item.y &&
                     centerY < item.y + item.h
                 ) {
                     onStackItems(draggingId, item.id);
                     break; // Only stack with one target at a time
                 }
             }
        }
    }

    if (isPanning) {
        startInertia();
    }
    setIsPanning(false);
    setDraggingId(null);
    setDragTilt(0);
    setSelectionBox(null);
  }, [isPanning, draggingId, resizingId, items, onStackItems, connectingLine, hoveredItemId, onConnect]); 

  useEffect(() => {
    if (isPanning || draggingId || resizingId || selectionBox || connectingLine) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, draggingId, resizingId, selectionBox, handleMouseMove, handleMouseUp, connectingLine]);

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (files.length > 0) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      onDropFiles(files, worldPos);
    }
  }, [screenToWorld, onDropFiles]);

  return (
    <div
      ref={canvasRef}
      id="canvas-bg"
      className={`w-full h-full relative overflow-hidden transition-colors duration-200 ${isDragOver ? 'bg-blue-50' : ''}`}
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        cursor: resizingId ? 'se-resize' : isPanning || isSpacePressed ? 'grab' : draggingId ? 'grabbing' : connectingLine ? 'crosshair' : 'default',
      }}
    >
      <div 
        className="absolute origin-center will-change-transform"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          left: '50%',
          top: '50%',
        }}
      >
        {/* Connections Layer (Below Items) */}
        <svg className="absolute top-0 left-0 overflow-visible" style={{ zIndex: 0 }}>
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                </marker>
            </defs>
            {connections.map(conn => {
                const fromItem = items.find(i => i.id === conn.from);
                const toItem = items.find(i => i.id === conn.to);
                if (!fromItem || !toItem) return null;

                // Calculate nearest edge points (handle to handle)
                const fromCenterX = fromItem.x + fromItem.w / 2;
                const fromCenterY = fromItem.y + fromItem.h / 2;
                const toCenterX = toItem.x + toItem.w / 2;
                const toCenterY = toItem.y + toItem.h / 2;

                // Determine best connection points based on relative positions
                let startX, startY, endX, endY;
                const dx = toCenterX - fromCenterX;
                const dy = toCenterY - fromCenterY;

                if (Math.abs(dx) > Math.abs(dy)) {
                    // Horizontal connection
                    if (dx > 0) {
                        startX = fromItem.x + fromItem.w; startY = fromCenterY; // Right
                        endX = toItem.x; endY = toCenterY; // Left
                    } else {
                        startX = fromItem.x; startY = fromCenterY; // Left
                        endX = toItem.x + toItem.w; endY = toCenterY; // Right
                    }
                } else {
                    // Vertical connection
                    if (dy > 0) {
                        startX = fromCenterX; startY = fromItem.y + fromItem.h; // Bottom
                        endX = toCenterX; endY = toItem.y; // Top
                    } else {
                        startX = fromCenterX; startY = fromItem.y; // Top
                        endX = toCenterX; endY = toItem.y + toItem.h; // Bottom
                    }
                }

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;

                return (
                    <g key={conn.id} className="group/edge cursor-pointer" onClick={() => onDeleteConnection(conn.id)}>
                        {/* Invisible wider path for easier clicking */}
                        <path
                            d={`M ${startX} ${startY} C ${startX + (endX - startX) * 0.5} ${startY}, ${endX - (endX - startX) * 0.5} ${endY}, ${endX} ${endY}`}
                            stroke="transparent"
                            strokeWidth="20"
                            fill="none"
                        />
                        {/* Visible path */}
                        <path
                            d={`M ${startX} ${startY} C ${startX + (endX - startX) * 0.5} ${startY}, ${endX - (endX - startX) * 0.5} ${endY}, ${endX} ${endY}`}
                            stroke="#cbd5e1"
                            strokeWidth="2"
                            fill="none"
                            markerEnd="url(#arrowhead)"
                            className="group-hover/edge:stroke-red-400 transition-colors"
                        />
                        {/* Delete indicator on hover */}
                        <circle
                            cx={midX}
                            cy={midY}
                            r="8"
                            fill="white"
                            stroke="#ef4444"
                            strokeWidth="2"
                            className="opacity-0 group-hover/edge:opacity-100 transition-opacity"
                        />
                        <text
                            x={midX}
                            y={midY + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill="#ef4444"
                            className="opacity-0 group-hover/edge:opacity-100 transition-opacity pointer-events-none"
                        >×</text>
                    </g>
                );
            })}
            {connectingLine && (
                <path
                    d={`M ${connectingLine.startX} ${connectingLine.startY} L ${connectingLine.endX} ${connectingLine.endY}`}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    className="pointer-events-none"
                />
            )}
        </svg>

        {items.map(item => (
          <ItemRenderer
            key={item.id}
            item={item}
            isSelected={selection.has(item.id)}
            isDragging={draggingId === item.id}
            isResizing={resizingId === item.id}
            dragTilt={draggingId === item.id ? dragTilt : 0}
            onMouseDown={(e) => handleItemMouseDown(e, item.id)}
            onResizeStart={handleResizeStart}
            onNavigate={onNavigate}
            onOpenMedia={(item, rect) => onOpenMedia(item, rect)}
            onOpenNote={(item, rect) => onOpenNote(item, rect)}
            onUpdateContent={(content) => {
                const updated = items.map(i => i.id === item.id ? { ...i, content } : i);
                onUpdateItems(updated);
            }}
            onEditFolderName={onEditFolderName}
            getSpaceItems={getSpaceItems}
            onHover={setHoveredItemId}
            onConnectStart={handleConnectStart}
          />
        ))}

        {/* Lasso Selection Box */}
        {selectionBox && (
            <div 
                className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-lg pointer-events-none z-[9999]"
                style={{
                    left: selectionBox.x,
                    top: selectionBox.y,
                    width: selectionBox.w,
                    height: selectionBox.h,
                }}
            />
        )}
      </div>
      
      {/* Hint for Space Panning (Fade out logic could be added) */}
      <div className="absolute bottom-8 left-8 text-gray-400 text-xs pointer-events-none select-none">
          Space + Drag to pan
      </div>

      {/* Drop Zone Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-3xl px-12 py-8 backdrop-blur-sm">
            <p className="text-blue-600 font-semibold text-lg">Drop files here</p>
          </div>
        </div>
      )}
    </div>
  );
};