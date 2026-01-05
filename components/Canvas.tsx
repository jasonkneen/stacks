import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { SpatialItem, Connection, LayoutType, SortOption } from '../types';
import { ItemRenderer } from './ItemRenderer';

interface CanvasProps {
  items: SpatialItem[];
  connections: Connection[];
  initialCamera?: { x: number; y: number; zoom: number };
  cameraOverride?: { x: number; y: number; zoom: number; id: string }; // id acts as a trigger
  selection: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onUpdateItems: (updater: SpatialItem[] | ((currentItems: SpatialItem[]) => SpatialItem[])) => void;
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
  onAIPromptStart: (itemId: string, position: { x: number; y: number }) => void;
  onCameraChange?: (camera: { x: number; y: number; zoom: number }) => void;
  onAutoArrange?: (layoutType: LayoutType, sortBy: SortOption, selectedIds: Set<string>) => void;
}

// Sort items by the given option
const sortItems = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return (b.metadata?.updatedAt || 0) - (a.metadata?.updatedAt || 0);
      case 'added':
        return (b.metadata?.createdAt || 0) - (a.metadata?.createdAt || 0);
      case 'name':
        return (a.content || '').localeCompare(b.content || '');
      case 'type':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });
};

// Grid Layout: Respects custom grid cell sizes
const arrangeGrid = (items: SpatialItem[], sortBy: SortOption, GRID_CELL_SIZE: number = 220, GRID_GAP: number = 40): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);
  const SLOT_SIZE = GRID_CELL_SIZE + GRID_GAP;

  // Build grid using item sizes
  const COLS = Math.ceil(Math.sqrt(items.length * 1.5));
  let currentX = 0;
  let currentY = 0;
  let currentRow = 0;
  let maxRowHeight = 0;

  const arranged = sorted.map((item) => {
    // Use stored grid dimensions or default to 1x1
    const gridW = item.metadata?.gridCellsX || 1;
    const gridH = item.metadata?.gridCellsY || 1;

    const w = gridW * SLOT_SIZE - GRID_GAP;
    const h = gridH * SLOT_SIZE - GRID_GAP;

    // Simple flow layout
    const x = currentX * SLOT_SIZE;
    const y = currentY * SLOT_SIZE;

    // Update position for next item
    currentX += gridW;
    maxRowHeight = Math.max(maxRowHeight, gridH);

    // Wrap to next row if needed
    if (currentX >= COLS) {
      currentX = 0;
      currentY += maxRowHeight;
      maxRowHeight = 0;
    }

    return {
      ...item,
      x,
      y,
      w,
      h,
      rotation: 0,
    };
  });

  // Center the grid
  const minX = Math.min(...arranged.map(i => i.x));
  const maxX = Math.max(...arranged.map(i => i.x + i.w));
  const minY = Math.min(...arranged.map(i => i.y));
  const maxY = Math.max(...arranged.map(i => i.y + i.h));

  const offsetX = -(minX + maxX) / 2;
  const offsetY = -(minY + maxY) / 2;

  return arranged.map(item => ({
    ...item,
    x: item.x + offsetX,
    y: item.y + offsetY
  }));
};

// Bento Layout: Masonry-style with varied sizes (wider preferred)
const arrangeBento = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);

  const GAP = 20;
  const SMALL = 180;
  const LARGE_W = 400; // Wider
  const LARGE_H = 280; // Less tall - landscape preference
  const COLS = 3;

  // Track column heights for masonry layout
  const colHeights = new Array(COLS).fill(0);

  const arranged = sorted.map((item, index) => {
    // Use stored grid dimensions or vary sizes
    const hasCustomSize = item.metadata?.gridCellsX || item.metadata?.gridCellsY;
    const isLarge = hasCustomSize || index % 4 === 0;

    const w = isLarge ? LARGE_W : SMALL;
    const h = isLarge ? LARGE_H : SMALL;

    // Find shortest column
    const minHeight = Math.min(...colHeights);
    const col = colHeights.indexOf(minHeight);

    // Position in that column
    const x = -((COLS * SMALL + (COLS - 1) * GAP) / 2) + col * (SMALL + GAP);
    const y = colHeights[col];

    // Update column height
    colHeights[col] += h + GAP;

    return {
      ...item,
      x,
      y,
      w,
      h,
      rotation: 0,
    };
  });

  // Center vertically
  const maxHeight = Math.max(...colHeights);
  return arranged.map(item => ({
    ...item,
    y: item.y - maxHeight / 2,
  }));
};

// Random Layout: Scattered with slight rotation for natural feel
const arrangeRandom = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);

  const SPREAD = 400;
  const SIZE_MIN = 160;
  const SIZE_MAX = 280;

  // Use seeded random for reproducibility based on item count
  let seed = items.length;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return sorted.map((item) => {
    const angle = seededRandom() * Math.PI * 2;
    const distance = seededRandom() * SPREAD;

    return {
      ...item,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      w: SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN),
      h: SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN),
      rotation: (seededRandom() - 0.5) * 10, // -5 to +5 degrees
    };
  });
};

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
  onMarkManuallyPositioned,
  onAIPromptStart,
  onCameraChange,
  onAutoArrange,
}) => {
  // Camera State
  const [camera, setCamera] = useState(initialCamera);

  // Save camera changes back to parent (debounced)
  useEffect(() => {
    if (onCameraChange) {
      const timeout = setTimeout(() => {
        onCameraChange(camera);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [camera, onCameraChange]);

  // Handle Camera Override (e.g. Auto Layout)
  useEffect(() => {
    if (cameraOverride) {
        setCamera({ x: cameraOverride.x, y: cameraOverride.y, zoom: cameraOverride.zoom });
        // Reset inertia when force moving
        velocityRef.current = { x: 0, y: 0 };
        cancelAnimationFrame(animationFrameRef.current);
    }
  }, [cameraOverride]);

  // Grid Settings
  const GRID_CELL_SIZE = 220;
  const GRID_GAP = 40;
  const GRID_SLOT_SIZE = GRID_CELL_SIZE + GRID_GAP;

  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartDataRef = useRef<{ mouseX: number; mouseY: number; itemPositions: Map<string, { x: number; y: number }> } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef<{ w: number; h: number; mouseX: number; mouseY: number; gridX: number; gridY: number } | null>(null);
  
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

  // Calculate visible grid slots based on viewport and camera
  const visibleGridSlots = useMemo(() => {
    if (!draggingId && !resizingId) return [];

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // World space bounds of visible area
    const worldLeft = (-camera.x - viewportW / 2) / camera.zoom;
    const worldRight = (-camera.x + viewportW / 2) / camera.zoom;
    const worldTop = (-camera.y - viewportH / 2) / camera.zoom;
    const worldBottom = (-camera.y + viewportH / 2) / camera.zoom;

    // Grid cell indices
    const startCol = Math.floor(worldLeft / GRID_SLOT_SIZE);
    const endCol = Math.ceil(worldRight / GRID_SLOT_SIZE);
    const startRow = Math.floor(worldTop / GRID_SLOT_SIZE);
    const endRow = Math.ceil(worldBottom / GRID_SLOT_SIZE);

    const slots: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        slots.push({
          x: col * GRID_SLOT_SIZE,
          y: row * GRID_SLOT_SIZE,
          w: GRID_CELL_SIZE,
          h: GRID_CELL_SIZE
        });
      }
    }

    return slots;
  }, [camera.x, camera.y, camera.zoom, draggingId, resizingId, GRID_SLOT_SIZE, GRID_CELL_SIZE]);

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

    // Store initial positions for absolute-position-based dragging
    const itemsToDrag = selection.has(itemId)
      ? items.filter(item => selection.has(item.id))
      : items.filter(item => item.id === itemId);

    const positionMap = new Map<string, { x: number; y: number }>();
    itemsToDrag.forEach(item => {
      positionMap.set(item.id, { x: item.x, y: item.y });
    });

    dragStartDataRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      itemPositions: positionMap
    };

    // Bring to front - use functional update to avoid stale closure bugs
    onUpdateItems(currentItems => {
      const maxZ = Math.max(...currentItems.map(i => i.zIndex), 0);
      return currentItems.map(item =>
          item.id === itemId ? { ...item, zIndex: maxZ + 1 } : item
      );
    });

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
      // Calculate current grid cells occupied
      const gridX = Math.round(item.w / GRID_SLOT_SIZE);
      const gridY = Math.round(item.h / GRID_SLOT_SIZE);

      resizeStartRef.current = {
          w: item.w,
          h: item.h,
          mouseX: e.clientX,
          mouseY: e.clientY,
          gridX: Math.max(1, gridX),
          gridY: Math.max(1, gridY)
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

        // Calculate raw new dimensions
        const rawW = Math.max(GRID_CELL_SIZE * 0.8, startData.w + scaledDeltaX);
        const rawH = Math.max(GRID_CELL_SIZE * 0.8, startData.h + scaledDeltaY);

        // Snap to grid multiples
        const gridCellsX = Math.max(1, Math.round(rawW / GRID_SLOT_SIZE));
        const gridCellsY = Math.max(1, Math.round(rawH / GRID_SLOT_SIZE));

        const newW = gridCellsX * GRID_SLOT_SIZE - GRID_GAP;
        const newH = gridCellsY * GRID_SLOT_SIZE - GRID_GAP;

        // Use functional update and store grid dimensions in metadata
        onUpdateItems(currentItems =>
            currentItems.map(item =>
                item.id === resizingId
                  ? {
                      ...item,
                      w: newW,
                      h: newH,
                      metadata: {
                        ...item.metadata,
                        gridCellsX,
                        gridCellsY
                      }
                    }
                  : item
            )
        );
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

    if (draggingId && dragStartDataRef.current) {
        // Drag Item Logic - use absolute positions
        const targetTilt = deltaX * 0.4;
        setDragTilt(Math.max(Math.min(targetTilt, 12), -12));

        // Calculate total mouse movement from drag start in screen space
        const totalDeltaX = e.clientX - dragStartDataRef.current.mouseX;
        const totalDeltaY = e.clientY - dragStartDataRef.current.mouseY;

        // Convert to world space ONCE
        const worldDeltaX = totalDeltaX / camera.zoom;
        const worldDeltaY = totalDeltaY / camera.zoom;

        // Use functional update with absolute positions from drag start
        onUpdateItems(currentItems =>
            currentItems.map(item => {
                const startPos = dragStartDataRef.current?.itemPositions.get(item.id);
                if (startPos) {
                    return { ...item, x: startPos.x + worldDeltaX, y: startPos.y + worldDeltaY };
                }
                return item;
            })
        );
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
    // Clear resize state and trigger auto-arrange around resized item
    if (resizingId) {
        const resizedItem = items.find(i => i.id === resizingId);

        if (resizedItem && onAutoArrange) {
          // Auto-arrange all OTHER items around the resized one
          const otherItemIds = items.filter(i => i.id !== resizingId).map(i => i.id);

          // Trigger arrange for other items only (keeps resized item in place)
          setTimeout(() => {
            // Use grid layout for the other items, positioned around the resized item
            const otherItems = items.filter(i => i.id !== resizingId);
            if (otherItems.length > 0) {
              // Simple grid arrangement around resized item
              const sorted = [...otherItems].sort((a, b) =>
                (b.metadata?.updatedAt || 0) - (a.metadata?.updatedAt || 0)
              );

              const arranged = sorted.map((item, index) => {
                const col = index % 3;
                const row = Math.floor(index / 3);
                return {
                  ...item,
                  x: resizedItem.x + (col - 1) * GRID_SLOT_SIZE + (col > 0 ? resizedItem.w + GRID_GAP : -GRID_SLOT_SIZE),
                  y: resizedItem.y + (row - 1) * GRID_SLOT_SIZE + (row > 0 ? resizedItem.h + GRID_GAP : -GRID_SLOT_SIZE),
                };
              });

              onUpdateItems([resizedItem, ...arranged]);
            }
          }, 50);
        }

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
        if (draggedItem && hoveredItemId && hoveredItemId !== draggingId) {
            // Stack with the hovered item
            onStackItems(draggingId, hoveredItemId);
        } else if (draggedItem) {
            // Check overlap by position
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
    dragStartDataRef.current = null;
    setDragTilt(0);
    setSelectionBox(null);
  }, [isPanning, draggingId, resizingId, items, onStackItems, connectingLine, hoveredItemId, onConnect, onMarkManuallyPositioned, selection, startInertia]); 

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
        className="absolute origin-center"
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
          left: '50%',
          top: '50%',
          willChange: isPanning || draggingId || resizingId ? 'transform' : 'auto',
        }}
      >
        {/* Connections Layer (Below Items) */}
        <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
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
                    <g key={conn.id} className="group/edge cursor-pointer pointer-events-auto" onClick={() => onDeleteConnection(conn.id)}>
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

        {/* Grid Slot Visualization - Only during drag/resize */}
        {visibleGridSlots.length > 0 && (
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
            {visibleGridSlots.map((slot, idx) => (
              <div
                key={idx}
                className="absolute border border-gray-300/20 rounded-2xl transition-opacity duration-200"
                style={{
                  left: slot.x,
                  top: slot.y,
                  width: slot.w,
                  height: slot.h,
                }}
              />
            ))}
          </div>
        )}

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
                // Use functional update to avoid stale closure
                onUpdateItems(currentItems =>
                    currentItems.map(i => i.id === item.id ? { ...i, content, metadata: { ...i.metadata, updatedAt: Date.now() } } : i)
                );
            }}
            onEditFolderName={onEditFolderName}
            getSpaceItems={getSpaceItems}
            onHover={setHoveredItemId}
            onConnectStart={handleConnectStart}
            onAIPromptStart={(e, itemId, pos) => onAIPromptStart(itemId, pos)}
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