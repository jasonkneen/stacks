import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { SpatialItem, Connection, LayoutType, SortOption } from '../types';
import { ItemRenderer } from './ItemRenderer';
import { LAYOUT_CONSTANTS } from '../utils/layouts';

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
  highlightedNodeId?: string | null; // For showing target node highlight
  onNodeClick?: (itemId: string) => void; // For changing AI target destination
  onBlankCanvasClick?: () => void; // For clearing AI prompt
  onBlankCanvasDoubleClick?: (position: { x: number; y: number }) => void; // For opening AI chat on empty canvas
  layoutType?: LayoutType; // Current layout mode - disables grid for 'random' and 'free'
  contextTip?: string; // Contextual tip to show in bottom-left
  contentZoom?: number; // Zoom level for content inside items (text size)
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
  onMarkManuallyPositioned,
  onAIPromptStart,
  onCameraChange,
  onAutoArrange,
  highlightedNodeId,
  onNodeClick,
  onBlankCanvasClick,
  onBlankCanvasDoubleClick,
  layoutType = 'grid',
  contextTip,
  contentZoom = 1,
}) => {
  // Disable grid snapping for random and free layouts
  const enableGridSnap = layoutType === 'grid' || layoutType === 'bento';
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

  const { GRID_CELL_SIZE, GRID_GAP, GRID_SLOT_SIZE } = LAYOUT_CONSTANTS;

  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartDataRef = useRef<{ mouseX: number; mouseY: number; itemPositions: Map<string, { x: number; y: number }>; grabOffsetX: number; grabOffsetY: number } | null>(null);
  const currentDragOffsetRef = useRef({ x: 0, y: 0 }); // Current offset
  const [dragOffsetTrigger, setDragOffsetTrigger] = useState(0); // Trigger re-render
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef<{ w: number; h: number; mouseX: number; mouseY: number; gridX: number; gridY: number; rotation: number; itemX: number; itemY: number } | null>(null);
  const resizeDimensionsRef = useRef<{ w: number; h: number; gridCellsX: number; gridCellsY: number; rotation: number } | null>(null);
  const resizeRafRef = useRef<number>(0);
  
  // Panning & Selection Modes
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const selectionBoxRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const [selectionBoxTrigger, setSelectionBoxTrigger] = useState(0);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); // Screen coords for delta calc

  // Connection State
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [connectingLine, setConnectingLine] = useState<{ fromId: string, startX: number, startY: number, endX: number, endY: number } | null>(null);

  // Drag & Drop State
  const [isDragOver, setIsDragOver] = useState(false);

  const lastMousePosRef = useRef({ x: 0, y: 0 });
  
  // Physics State
  const dragTiltRef = useRef(0);
  
  // Inertia State
  const velocityRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Calculate visible grid slots based on viewport and camera - only when actually dragging/resizing
  const visibleGridSlots = useMemo(() => {
    // Don't show grid for random or free layouts
    if (!enableGridSnap) return [];
    if (!draggingId && !resizingId) return [];

    // Limit grid to reasonable area to avoid performance issues
    const GRID_RADIUS = 5; // Show 5x5 grid cells around center

    const slots: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (let row = -GRID_RADIUS; row <= GRID_RADIUS; row++) {
      for (let col = -GRID_RADIUS; col <= GRID_RADIUS; col++) {
        slots.push({
          x: col * GRID_SLOT_SIZE,
          y: row * GRID_SLOT_SIZE,
          w: GRID_CELL_SIZE,
          h: GRID_CELL_SIZE
        });
      }
    }

    return slots;
  }, [enableGridSnap, draggingId, resizingId, GRID_SLOT_SIZE, GRID_CELL_SIZE]);

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
    const isPanTrigger = e.button === 1 || e.button === 2 || isSpacePressed;

    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'canvas-bg') {
        if (onBlankCanvasClick && e.button === 0 && !isPanTrigger) {
          onBlankCanvasClick();
          return;
        }

        if (isPanTrigger) {
            e.preventDefault();
            setIsPanning(true);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            velocityRef.current = { x: 0, y: 0 };
            cancelAnimationFrame(animationFrameRef.current);
        } else if (e.button === 0) {
            if (!e.shiftKey) {
                onSelectionChange(new Set());
            }
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const initialBox = { x: worldPos.x, y: worldPos.y, w: 0, h: 0 };
            selectionBoxRef.current = initialBox;
            setSelectionBox(initialBox);
            setDragStartPos({ x: e.clientX, y: e.clientY });
        }
    }
  };

  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();

    // If onNodeClick is set (AI target mode), intercept clicks to change destination
    if (onNodeClick) {
      onNodeClick(itemId);
      return;
    }

    // Store initial positions for absolute-position-based dragging
    const itemsToDrag = selection.has(itemId)
      ? items.filter(item => selection.has(item.id))
      : items.filter(item => item.id === itemId);

    const positionMap = new Map<string, { x: number; y: number }>();
    itemsToDrag.forEach(item => {
      positionMap.set(item.id, { x: item.x, y: item.y });
    });

    // Calculate grab point relative to item center (normalized -1 to 1)
    const grabbedItem = items.find(i => i.id === itemId);
    const worldPos = screenToWorld(e.clientX, e.clientY);
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    if (grabbedItem) {
      const itemCenterX = grabbedItem.x + grabbedItem.w / 2;
      const itemCenterY = grabbedItem.y + grabbedItem.h / 2;
      grabOffsetX = (worldPos.x - itemCenterX) / (grabbedItem.w / 2); // -1 (left) to 1 (right)
      grabOffsetY = (worldPos.y - itemCenterY) / (grabbedItem.h / 2); // -1 (top) to 1 (bottom)
    }

    dragStartDataRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      itemPositions: positionMap,
      grabOffsetX,
      grabOffsetY
    };

    // Bring to front - use functional update to avoid stale closure bugs
    onUpdateItems(currentItems => {
      const maxZ = Math.max(...currentItems.map(i => i.zIndex), 0);
      return currentItems.map(item =>
          item.id === itemId ? { ...item, zIndex: maxZ + 1 } : item
      );
    });

    setDraggingId(itemId);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    dragTiltRef.current = 0;
    
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
          gridY: Math.max(1, gridY),
          rotation: item.rotation,
          itemX: item.x,
          itemY: item.y
      };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Update velocity for inertia
    velocityRef.current = { x: deltaX, y: deltaY };

    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Handle resize - FREE resize with magnetic snap + rotation
    if (resizingId && resizeStartRef.current) {
        const startData = resizeStartRef.current;
        const deltaMouseX = e.clientX - startData.mouseX;
        const deltaMouseY = e.clientY - startData.mouseY;

        // Scale delta by zoom level
        const scaledDeltaX = deltaMouseX / camera.zoom;
        const scaledDeltaY = deltaMouseY / camera.zoom;

        // Calculate raw new dimensions
        let newW = Math.max(GRID_CELL_SIZE * 0.5, startData.w + scaledDeltaX);
        let newH = Math.max(GRID_CELL_SIZE * 0.5, startData.h + scaledDeltaY);

        // Calculate grid cells for metadata
        const gridCellsX = Math.max(1, Math.round(newW / GRID_SLOT_SIZE));
        const gridCellsY = Math.max(1, Math.round(newH / GRID_SLOT_SIZE));

        // Magnetic snap during resize (only for grid/bento layouts)
        if (enableGridSnap) {
          const SNAP_TOLERANCE = 30;
          const snappedW = gridCellsX * GRID_SLOT_SIZE - GRID_GAP;
          const snappedH = gridCellsY * GRID_SLOT_SIZE - GRID_GAP;

          const distanceW = Math.abs(newW - snappedW);
          const distanceH = Math.abs(newH - snappedH);

          // Apply magnetic snap if within tolerance
          if (distanceW <= SNAP_TOLERANCE) {
              newW = snappedW;
          }
          if (distanceH <= SNAP_TOLERANCE) {
              newH = snappedH;
          }
        }

        // Calculate rotation from top-left corner (world space)
        const mouseWorldX = worldPos.x;
        const mouseWorldY = worldPos.y;
        const topLeftX = startData.itemX;
        const topLeftY = startData.itemY;

        // Angle from top-left to mouse position
        const dx = mouseWorldX - topLeftX;
        const dy = mouseWorldY - topLeftY;
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = (angleRad * 180 / Math.PI) - 45; // -45 to align with SE resize handle

        // Clamp rotation to reasonable range
        const newRotation = Math.max(-15, Math.min(15, angleDeg * 0.3));

        // Store in ref
        resizeDimensionsRef.current = { w: newW, h: newH, gridCellsX, gridCellsY, rotation: newRotation };

        // Direct DOM manipulation for 60fps visual feedback (no React re-render)
        if (!resizeRafRef.current) {
          resizeRafRef.current = requestAnimationFrame(() => {
            const el = document.querySelector(`[data-item-id="${resizingId}"]`) as HTMLElement;
            if (el && resizeDimensionsRef.current) {
              el.style.width = `${resizeDimensionsRef.current.w}px`;
              el.style.height = `${resizeDimensionsRef.current.h}px`;
              const existingTransform = el.style.transform.replace(/rotate\([^)]+\)/, '').trim();
              el.style.transform = `${existingTransform} rotate(${resizeDimensionsRef.current.rotation}deg)`;
            }
            resizeRafRef.current = 0;
          });
        }

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
        // Drag Item Logic - smooth tilt with momentum (no swing-back)
        const targetTilt = Math.max(Math.min(deltaX * 0.5, 15), -15);
        const currentTilt = dragTiltRef.current;

        // Only approach target if moving in same direction or target is stronger
        // This prevents swing-back when slowing down
        if (Math.abs(targetTilt) > Math.abs(currentTilt) || Math.sign(targetTilt) === Math.sign(currentTilt)) {
            // Quick response when adding tilt
            dragTiltRef.current = currentTilt + (targetTilt - currentTilt) * 0.3;
        } else {
            // Very slow decay - don't swing back during motion
            dragTiltRef.current = currentTilt * 0.98;
        }

        // Calculate total mouse movement from drag start
        const totalDeltaX = e.clientX - dragStartDataRef.current.mouseX;
        const totalDeltaY = e.clientY - dragStartDataRef.current.mouseY;

        // Convert to world space
        let worldDeltaX = totalDeltaX / camera.zoom;
        let worldDeltaY = totalDeltaY / camera.zoom;

        // Magnetic snap during drag (only for grid/bento layouts)
        if (enableGridSnap) {
          const SNAP_TOLERANCE = 40;
          const draggedItem = items.find(i => i.id === draggingId);
          if (draggedItem) {
              const startPos = dragStartDataRef.current.itemPositions.get(draggingId);
              if (startPos) {
                  const currentX = startPos.x + worldDeltaX;
                  const currentY = startPos.y + worldDeltaY;

                  const snappedX = Math.round(currentX / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;
                  const snappedY = Math.round(currentY / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;

                  const distanceX = Math.abs(currentX - snappedX);
                  const distanceY = Math.abs(currentY - snappedY);

                  // Apply magnetic snap if within tolerance
                  if (distanceX <= SNAP_TOLERANCE) {
                      worldDeltaX = snappedX - startPos.x;
                  }
                  if (distanceY <= SNAP_TOLERANCE) {
                      worldDeltaY = snappedY - startPos.y;
                  }
              }
          }
        }

        // Store offset in ref and trigger render
        currentDragOffsetRef.current = { x: worldDeltaX, y: worldDeltaY };
        setDragOffsetTrigger(prev => prev + 1);
    } else if (selectionBox) {
        // Lasso Selection Logic - use ref for visual, defer selection calc to mouseUp
        const currentWorldPos = worldPos;
        const startWorldPos = screenToWorld(dragStartPos.x, dragStartPos.y);

        const newBox = {
            x: Math.min(startWorldPos.x, currentWorldPos.x),
            y: Math.min(startWorldPos.y, currentWorldPos.y),
            w: Math.abs(currentWorldPos.x - startWorldPos.x),
            h: Math.abs(currentWorldPos.y - startWorldPos.y)
        };

        // Store in ref and trigger lightweight re-render
        selectionBoxRef.current = newBox;
        setSelectionBoxTrigger(prev => prev + 1);
    }
  }, [isPanning, draggingId, resizingId, selectionBox, camera.zoom, items, selection, onUpdateItems, screenToWorld, dragStartPos, onSelectionChange, connectingLine]);

  const handleMouseUp = useCallback(() => {
    // Cancel any pending resize RAF
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = 0;
    }

    // Clear resize state and persist final dimensions + rotation
    if (resizingId && resizeDimensionsRef.current) {
        const { w, h, gridCellsX, gridCellsY, rotation } = resizeDimensionsRef.current;

        // Persist resize + rotation to parent state NOW (on mouseup only)
        onUpdateItems(currentItems =>
            currentItems.map(item =>
                item.id === resizingId
                  ? {
                      ...item,
                      w,
                      h,
                      rotation,
                      metadata: {
                        ...item.metadata,
                        gridCellsX,
                        gridCellsY
                      }
                    }
                  : item
            )
        );

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
        resizeDimensionsRef.current = null;
        return;
    }

    if (connectingLine) {
        // Check for connection drop
        if (hoveredItemId && hoveredItemId !== connectingLine.fromId) {
            onConnect(connectingLine.fromId, hoveredItemId);
        }
        setConnectingLine(null);
    }

    if (draggingId && dragStartDataRef.current) {
        // Capture values BEFORE clearing refs (closures would see null otherwise)
        const finalOffset = { ...currentDragOffsetRef.current };
        const itemPositions = new Map(dragStartDataRef.current.itemPositions);

        // Physics-based settle tilt: drag direction determines final tilt
        // Drag right → settle tilted right (positive rotation)
        // Drag left → settle tilted left (negative rotation)
        const settleTilt = dragTiltRef.current * 0.5;

        const SNAP_TOLERANCE = 40;

        // Apply final positions and settle rotation based on drag direction
        onUpdateItems(currentItems =>
            currentItems.map(item => {
                const startPos = itemPositions.get(item.id);
                if (startPos) {
                    const finalX = startPos.x + finalOffset.x;
                    const finalY = startPos.y + finalOffset.y;

                    // Check if close to grid snap point (only if grid snap enabled)
                    if (enableGridSnap) {
                      const nearestGridX = Math.round(finalX / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;
                      const nearestGridY = Math.round(finalY / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;
                      const distX = Math.abs(finalX - nearestGridX);
                      const distY = Math.abs(finalY - nearestGridY);

                      // If dropped within snap tolerance, snap to grid and remove rotation
                      if (distX <= SNAP_TOLERANCE && distY <= SNAP_TOLERANCE) {
                        return {
                          ...item,
                          x: nearestGridX,
                          y: nearestGridY,
                          rotation: 0 // Aligned to grid = no rotation
                        };
                      }
                    }

                    // Dropped away from grid = keep jaunty rotation
                    return {
                        ...item,
                        x: finalX,
                        y: finalY,
                        rotation: item.rotation + settleTilt
                    };
                }
                return item;
            })
        );

        // Mark dragged items as manually positioned
        const draggedIds = selection.has(draggingId)
          ? Array.from(selection).filter(id => items.find(i => i.id === id))
          : [draggingId];
        onMarkManuallyPositioned(draggedIds);

        // --- STACKING DETECTION ---
        // Only stack if explicitly hovering over a folder, not on overlap
        const draggedItemRaw = items.find(i => i.id === draggingId);
        if (draggedItemRaw && hoveredItemId && hoveredItemId !== draggingId) {
            const hoveredItem = items.find(i => i.id === hoveredItemId);
            // Only auto-stack when dropping on a folder
            if (hoveredItem?.type === 'folder') {
                onStackItems(draggingId, hoveredItemId);
            }
        }
        // DISABLED: Auto-stacking on overlap creates too many false positives
        // Users can manually drag onto folders to stack
    }

    // Calculate final selection from lasso box
    if (selectionBox && selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const newSelection = new Set<string>();

        items.forEach(item => {
            const isIntersecting =
                item.x < box.x + box.w &&
                item.x + item.w > box.x &&
                item.y < box.y + box.h &&
                item.y + item.h > box.y;

            if (isIntersecting) {
                newSelection.add(item.id);
            }
        });

        onSelectionChange(newSelection);
    }

    if (isPanning) {
        startInertia();
    }
    setIsPanning(false);
    setDraggingId(null);
    dragStartDataRef.current = null;
    currentDragOffsetRef.current = { x: 0, y: 0 };
    selectionBoxRef.current = null;
    dragTiltRef.current = 0;
    setSelectionBox(null);
  }, [isPanning, draggingId, resizingId, items, onStackItems, connectingLine, hoveredItemId, onConnect, onMarkManuallyPositioned, selection, startInertia, selectionBox, onSelectionChange]); 

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

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on canvas background (not on items)
    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'canvas-bg') {
      if (onBlankCanvasDoubleClick) {
        onBlankCanvasDoubleClick({ x: e.clientX, y: e.clientY });
      }
    }
  }, [onBlankCanvasDoubleClick]);

  return (
    <div
      ref={canvasRef}
      id="canvas-bg"
      className={`w-full h-full relative overflow-hidden transition-colors duration-200 ${isDragOver ? 'bg-blue-50' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleCanvasDoubleClick}
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
                const fromItemRaw = items.find(i => i.id === conn.from);
                const toItemRaw = items.find(i => i.id === conn.to);
                if (!fromItemRaw || !toItemRaw) return null;

                // Apply visual offset ONLY while actively dragging
                const offset = currentDragOffsetRef.current;
                const fromIsDragged = draggingId && dragStartDataRef.current?.itemPositions.has(fromItemRaw.id);
                const toIsDragged = draggingId && dragStartDataRef.current?.itemPositions.has(toItemRaw.id);

                const fromItem = fromIsDragged
                  ? { ...fromItemRaw, x: fromItemRaw.x + offset.x, y: fromItemRaw.y + offset.y }
                  : fromItemRaw;
                const toItem = toIsDragged
                  ? { ...toItemRaw, x: toItemRaw.x + offset.x, y: toItemRaw.y + offset.y }
                  : toItemRaw;

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

        {/* Grid Slot Visualization - Only during drag/resize (GPU accelerated) */}
        {visibleGridSlots.length > 0 && (
          <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
            {visibleGridSlots.map((slot, idx) => (
              <div
                key={idx}
                className="absolute border border-gray-300/20 rounded-2xl"
                style={{
                  transform: `translate3d(${slot.x}px, ${slot.y}px, 0)`,
                  width: slot.w,
                  height: slot.h,
                  willChange: 'transform',
                }}
              />
            ))}
          </div>
        )}

        {items.map(item => {
          // Apply visual offset ONLY while actively dragging (draggingId is set)
          // Once mouseUp fires, draggingId becomes null - use committed positions
          const isDragged = draggingId && dragStartDataRef.current?.itemPositions.has(item.id);
          const offset = currentDragOffsetRef.current;
          let visualItem = isDragged ? { ...item, x: item.x + offset.x, y: item.y + offset.y } : item;

          // Apply visual resize dimensions + rotation during resize (before persistence)
          const isResized = resizingId === item.id && resizeDimensionsRef.current;
          if (isResized) {
            visualItem = {
              ...visualItem,
              w: resizeDimensionsRef.current!.w,
              h: resizeDimensionsRef.current!.h,
              rotation: resizeDimensionsRef.current!.rotation
            };
          }

          return (
            <ItemRenderer
              key={item.id}
              item={visualItem}
              isSelected={selection.has(item.id)}
              isHighlighted={highlightedNodeId === item.id}
              isDragging={draggingId === item.id}
              isResizing={resizingId === item.id}
              dragTilt={draggingId === item.id ? dragTiltRef.current : 0}
              zoom={camera.zoom}
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
              contentZoom={contentZoom}
            />
          );
        })}

        {/* Lasso Selection Box - uses ref for smooth visual during drag (GPU accelerated) */}
        {selectionBox && selectionBoxRef.current && (
            <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-lg pointer-events-none z-[9999]"
                style={{
                    transform: `translate3d(${selectionBoxRef.current.x}px, ${selectionBoxRef.current.y}px, 0)`,
                    width: selectionBoxRef.current.w,
                    height: selectionBoxRef.current.h,
                    willChange: 'transform, width, height',
                }}
            />
        )}
      </div>
      
      {/* Contextual Tip (bottom-left) */}
      <div className="absolute bottom-8 left-8 text-gray-400 text-xs pointer-events-none select-none transition-opacity duration-300">
          {contextTip || 'Space + Drag to pan'}
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