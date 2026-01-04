import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ContextToolbar } from './components/ContextToolbar';
import { MediaViewer } from './components/MediaViewer';
import { AIModal } from './components/AIModal';
import { Space, SpatialItem, Connection } from './types';
import { ArrowLeft, Menu } from 'lucide-react';
import ELK from 'elkjs';

// Initial Demo Data
const ROOT_SPACE_ID = 'root';
const INITIAL_SPACES: Record<string, Space> = {
  [ROOT_SPACE_ID]: {
    id: ROOT_SPACE_ID,
    name: 'Home',
    parentId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    items: [
      {
        id: '1',
        type: 'note',
        x: -400,
        y: -250,
        w: 320,
        h: 400,
        zIndex: 1,
        rotation: -1.2,
        content: `<h1>Welcome to Spatial Alpha</h1><p>This is an "open air space" for thinking.</p><ul><li>Drag items to move them.</li><li>Double-click a folder to enter.</li><li>Double-click media to view.</li><li>Double-click a note to edit.</li><li>Scroll to pan, Ctrl+Scroll to zoom.</li></ul>`,
      },
      {
        id: '2',
        type: 'sticky',
        x: 0,
        y: -200,
        w: 220,
        h: 220,
        zIndex: 2,
        rotation: 2.5,
        content: `Don't forget to check the roadmap!`,
        color: 'bg-yellow-200'
      },
      {
        id: '3',
        type: 'image',
        x: -350,
        y: 200,
        w: 400,
        h: 300,
        zIndex: 3,
        rotation: -2,
        content: 'https://picsum.photos/800/600',
        metadata: { size: '1.2MB', resolution: '800x600' }
      },
      {
        id: '4',
        type: 'folder',
        x: 100,
        y: 100,
        w: 200,
        h: 240,
        zIndex: 4,
        rotation: 1.5,
        content: 'Project Alpha',
        linkedSpaceId: 'project-alpha'
      },
       {
        id: '5',
        type: 'video',
        x: 300,
        y: -250,
        w: 300,
        h: 200,
        zIndex: 5,
        rotation: -1,
        content: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        metadata: { duration: '9:56', fps: '24', resolution: '720p', size: '24MB' }
      }
    ],
    connections: []
  },
  'project-alpha': {
    id: 'project-alpha',
    name: 'Project Alpha',
    parentId: ROOT_SPACE_ID,
    camera: { x: 0, y: 0, zoom: 1 },
    items: [
      {
        id: 'pa-1',
        type: 'sticky',
        x: -300,
        y: -150,
        w: 250,
        h: 250,
        zIndex: 1,
        rotation: 3,
        content: 'Brainstorming session notes go here.',
        color: 'bg-green-200'
      },
      {
        id: 'pa-2',
        type: 'image',
        x: 50,
        y: -150,
        w: 400,
        h: 300,
        zIndex: 2,
        rotation: -2.5,
        content: 'https://picsum.photos/800/601',
        metadata: { size: '2.4MB', resolution: '800x600' }
      }
    ],
    connections: []
  }
};

const elk = new ELK();

// Utility to calculate best-fit view
const getFitToViewParams = (items: SpatialItem[]) => {
    if (items.length === 0) return { x: 0, y: 0, zoom: 1 };

    const padding = 100;
    const minX = Math.min(...items.map(i => i.x));
    const maxX = Math.max(...items.map(i => i.x + i.w));
    const minY = Math.min(...items.map(i => i.y));
    const maxY = Math.max(...items.map(i => i.y + i.h));

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Determine scale to fit
    const scaleX = (screenW - padding * 2) / width;
    const scaleY = (screenH - padding * 2) / height;
    
    // Clamp zoom to reasonable levels
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.5);

    // Calculate camera offset
    return {
        x: -centerX * zoom,
        y: -centerY * zoom,
        zoom
    };
};

const App: React.FC = () => {
  const [spaces, setSpaces] = useState<Record<string, Space>>(INITIAL_SPACES);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(ROOT_SPACE_ID);
  const [mediaViewerItem, setMediaViewerItem] = useState<SpatialItem | null>(null);
  const [mediaViewerRect, setMediaViewerRect] = useState<DOMRect | null>(null);
  const [isLayouting, setIsLayouting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showAIModal, setShowAIModal] = useState(false);
  
  // To trigger camera moves programmatically in Canvas
  const [cameraOverride, setCameraOverride] = useState<{ x: number, y: number, zoom: number, id: string } | undefined>(undefined);

  const activeSpace = spaces[activeSpaceId];

  // Helper to update items in the current space
  const updateItems = useCallback((newItems: SpatialItem[]) => {
    setSpaces(prev => ({
      ...prev,
      [activeSpaceId]: {
        ...prev[activeSpaceId],
        items: newItems,
      }
    }));
  }, [activeSpaceId]);

  // Update specific item props (e.g. Color)
  const handleUpdateItem = useCallback((id: string, changes: Partial<SpatialItem>) => {
    const newItems = activeSpace.items.map(i => i.id === id ? { ...i, ...changes } : i);
    updateItems(newItems);
  }, [activeSpace.items, updateItems]);

  // Helper to trigger auto-fit view
  const triggerAutoFit = useCallback(() => {
    setTimeout(() => {
      setSpaces(currentSpaces => {
        const items = currentSpaces[activeSpaceId]?.items || [];
        if (items.length > 0) {
          const fitParams = getFitToViewParams(items);
          setCameraOverride({ ...fitParams, id: Date.now().toString() });
        }
        return currentSpaces; // No mutation, just reading
      });
    }, 50);
  }, [activeSpaceId]);

  // Delete items
  const handleDeleteItems = useCallback((ids: Set<string>) => {
    setSpaces(prev => {
        const space = prev[activeSpaceId];
        const newItems = space.items.filter(i => !ids.has(i.id));
        // Remove connections attached to deleted items
        const newConnections = (space.connections || []).filter(c => !ids.has(c.from) && !ids.has(c.to));

        return {
            ...prev,
            [activeSpaceId]: {
                ...space,
                items: newItems,
                connections: newConnections
            }
        };
    });
    setSelection(new Set());
    triggerAutoFit();
  }, [activeSpaceId, triggerAutoFit]);

  // Ungroup a stack/folder back into individual items
  const handleUngroup = useCallback((folderId: string) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const folder = space.items.find(i => i.id === folderId);

      if (!folder || folder.type !== 'folder' || !folder.linkedSpaceId) return prev;

      const linkedSpace = prev[folder.linkedSpaceId];
      if (!linkedSpace) return prev;

      // Position items around where the folder was
      const unpackedItems = linkedSpace.items.map((item, index) => ({
        ...item,
        x: folder.x + (index % 3) * 40 - 40,
        y: folder.y + Math.floor(index / 3) * 40 - 40,
        zIndex: Math.max(...space.items.map(i => i.zIndex), 0) + index + 1
      }));

      // Remove folder, add unpacked items
      const newItems = [
        ...space.items.filter(i => i.id !== folderId),
        ...unpackedItems
      ];

      // Update connections: redirect folder connections to first unpacked item
      const firstUnpackedId = unpackedItems[0]?.id;
      const newConnections = (space.connections || []).map(conn => ({
        ...conn,
        from: conn.from === folderId && firstUnpackedId ? firstUnpackedId : conn.from,
        to: conn.to === folderId && firstUnpackedId ? firstUnpackedId : conn.to
      }));

      // Remove the linked space
      const { [folder.linkedSpaceId]: _, ...remainingSpaces } = prev;

      return {
        ...remainingSpaces,
        [activeSpaceId]: {
          ...space,
          items: newItems,
          connections: newConnections
        }
      };
    });
    setSelection(new Set());
    triggerAutoFit();
  }, [activeSpaceId, triggerAutoFit]);

  // Group selected items into a new stack
  const handleGroupToStack = useCallback((ids: Set<string>) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const selectedItems = space.items.filter(i => ids.has(i.id));
      const remainingItems = space.items.filter(i => !ids.has(i.id));

      if (selectedItems.length < 2) return prev;

      // Calculate center of selected items
      const centerX = selectedItems.reduce((sum, i) => sum + i.x + i.w / 2, 0) / selectedItems.length;
      const centerY = selectedItems.reduce((sum, i) => sum + i.y + i.h / 2, 0) / selectedItems.length;

      // Create new space ID
      const newSpaceId = `stack-${Date.now()}`;

      // Reposition items relative to (0,0) for the new space
      const stackedItems = selectedItems.map(item => ({
        ...item,
        x: item.x - centerX + item.w / 2,
        y: item.y - centerY + item.h / 2,
      }));

      // Create the folder item
      const folderId = `folder-${Date.now()}`;
      const folderItem: SpatialItem = {
        id: folderId,
        type: 'folder',
        x: centerX - 100,
        y: centerY - 120,
        w: 200,
        h: 240,
        zIndex: Math.max(...space.items.map(i => i.zIndex), 0) + 1,
        rotation: 0,
        content: `Stack (${selectedItems.length})`,
        linkedSpaceId: newSpaceId
      };

      // Update connections: redirect any pointing to selected items to point to folder
      const updatedConnections = (space.connections || []).map(conn => {
        let newConn = { ...conn };
        if (ids.has(conn.from)) newConn.from = folderId;
        if (ids.has(conn.to)) newConn.to = folderId;
        return newConn;
      }).filter(conn => conn.from !== conn.to); // Remove self-loops

      // Dedupe connections
      const seenConnections = new Set<string>();
      const dedupedConnections = updatedConnections.filter(conn => {
        const key = `${conn.from}-${conn.to}`;
        if (seenConnections.has(key)) return false;
        seenConnections.add(key);
        return true;
      });

      return {
        ...prev,
        [activeSpaceId]: {
          ...space,
          items: [...remainingItems, folderItem],
          connections: dedupedConnections
        },
        [newSpaceId]: {
          id: newSpaceId,
          name: `Stack (${selectedItems.length})`,
          parentId: activeSpaceId,
          items: stackedItems,
          connections: [],
          camera: { x: 0, y: 0, zoom: 1 }
        }
      };
    });
    setSelection(new Set());
    triggerAutoFit();
  }, [activeSpaceId, triggerAutoFit]);

  const getSpaceItems = useCallback((spaceId: string) => {
    return spaces[spaceId]?.items || [];
  }, [spaces]);

  // Handle file drops
  const handleDropFiles = useCallback(async (files: File[], position: { x: number; y: number }) => {
    const readFile = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    };

    const newItems: SpatialItem[] = [];
    const baseZIndex = Math.max(...(spaces[activeSpaceId]?.items.map(i => i.zIndex) || [0]), 0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await readFile(file);
      const isVideo = file.type.startsWith('video/');

      newItems.push({
        id: `drop-${Date.now()}-${i}`,
        type: isVideo ? 'video' : 'image',
        x: position.x + (i % 3) * 40 - 40,
        y: position.y + Math.floor(i / 3) * 40 - 40,
        w: 300,
        h: isVideo ? 200 : 250,
        zIndex: baseZIndex + i + 1,
        rotation: (Math.random() - 0.5) * 6,
        content: dataUrl,
        metadata: {
          filename: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
          type: file.type
        }
      });
    }

    // If multiple files, create a stack
    if (newItems.length > 1) {
      const newSpaceId = `drop-stack-${Date.now()}`;
      const folderId = `folder-${Date.now()}`;

      const folderItem: SpatialItem = {
        id: folderId,
        type: 'folder',
        x: position.x - 100,
        y: position.y - 120,
        w: 200,
        h: 240,
        zIndex: baseZIndex + 1,
        rotation: 0,
        content: `Dropped (${newItems.length})`,
        linkedSpaceId: newSpaceId
      };

      // Reposition items for stack space
      const stackItems = newItems.map((item, idx) => ({
        ...item,
        x: (idx % 3) * 60 - 60,
        y: Math.floor(idx / 3) * 60 - 60,
        zIndex: idx + 1
      }));

      setSpaces(prev => ({
        ...prev,
        [activeSpaceId]: {
          ...prev[activeSpaceId],
          items: [...prev[activeSpaceId].items, folderItem]
        },
        [newSpaceId]: {
          id: newSpaceId,
          name: `Dropped (${newItems.length})`,
          parentId: activeSpaceId,
          items: stackItems,
          connections: [],
          camera: { x: 0, y: 0, zoom: 1 }
        }
      }));
      triggerAutoFit();
    } else if (newItems.length === 1) {
      // Single file, just add it
      updateItems([...spaces[activeSpaceId].items, newItems[0]]);
      triggerAutoFit();
    }
  }, [activeSpaceId, spaces, updateItems, triggerAutoFit]);

  const handleConnect = useCallback((fromId: string, toId: string) => {
      setSpaces(prev => {
          const space = prev[activeSpaceId];
          // Prevent duplicates
          if (space.connections?.some(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId))) {
              return prev;
          }
          const newConnection: Connection = {
              id: `conn-${Date.now()}`,
              from: fromId,
              to: toId
          };
          return {
              ...prev,
              [activeSpaceId]: {
                  ...space,
                  connections: [...(space.connections || []), newConnection]
              }
          };
      });
  }, [activeSpaceId]);

  const handleDeleteConnection = useCallback((connectionId: string) => {
      setSpaces(prev => {
          const space = prev[activeSpaceId];
          return {
              ...prev,
              [activeSpaceId]: {
                  ...space,
                  connections: (space.connections || []).filter(c => c.id !== connectionId)
              }
          };
      });
  }, [activeSpaceId]);

  // Handle variant creation from MediaViewer
  const handleCreateVariant = useCallback((originalItem: SpatialItem, variantUrl: string, prompt: string) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];

      // Create variant item
      const variantItem: SpatialItem = {
        id: `variant-${Date.now()}`,
        type: originalItem.type,
        x: 20,
        y: 20,
        w: originalItem.w,
        h: originalItem.h,
        zIndex: 2,
        rotation: (Math.random() - 0.5) * 4,
        content: variantUrl,
        metadata: {
          ...originalItem.metadata,
          prompt,
          isVariant: true,
          originalId: originalItem.id
        }
      };

      // Create new space for the stack
      const newSpaceId = `variants-${Date.now()}`;

      // Create folder to replace original
      const folderItem: SpatialItem = {
        id: `folder-${Date.now()}`,
        type: 'folder',
        x: originalItem.x,
        y: originalItem.y,
        w: 200,
        h: 240,
        zIndex: originalItem.zIndex,
        rotation: 0,
        content: 'Variants',
        linkedSpaceId: newSpaceId
      };

      // Remove original, add folder
      const newItems = space.items.map(i =>
        i.id === originalItem.id ? folderItem : i
      );

      // Update connections to point to folder
      const newConnections = (space.connections || []).map(conn => ({
        ...conn,
        from: conn.from === originalItem.id ? folderItem.id : conn.from,
        to: conn.to === originalItem.id ? folderItem.id : conn.to
      }));

      return {
        ...prev,
        [activeSpaceId]: {
          ...space,
          items: newItems,
          connections: newConnections
        },
        [newSpaceId]: {
          id: newSpaceId,
          name: 'Variants',
          parentId: activeSpaceId,
          items: [
            { ...originalItem, x: -20, y: -20, zIndex: 1, rotation: -2 },
            variantItem
          ],
          connections: [],
          camera: { x: 0, y: 0, zoom: 1 }
        }
      };
    });

    // Close viewer and show the new stack
    setMediaViewerItem(null);
  }, [activeSpaceId]);

  // Handle Stacking Interaction
  const handleStackItems = useCallback((sourceId: string, targetId: string) => {
    setSpaces(prev => {
        const currentSpace = prev[activeSpaceId];
        const sourceItem = currentSpace.items.find(i => i.id === sourceId);
        const targetItem = currentSpace.items.find(i => i.id === targetId);

        if (!sourceItem || !targetItem) return prev;

        const remainingItems = currentSpace.items.filter(i => i.id !== sourceId && i.id !== targetId);
        // Remove connections for moved items
        const remainingConnections = (currentSpace.connections || []).filter(c => 
            c.from !== sourceId && c.to !== sourceId && c.from !== targetId && c.to !== targetId
        );

        // Case A: Target is a folder -> Add source to it
        if (targetItem.type === 'folder' && targetItem.linkedSpaceId) {
            const targetSpaceId = targetItem.linkedSpaceId;
            const targetSpace = prev[targetSpaceId];
            
            // Re-center item roughly in the new space (random jitter for natural look)
            const newItemInFolder = {
                ...sourceItem,
                x: (Math.random() - 0.5) * 40, 
                y: (Math.random() - 0.5) * 40,
                zIndex: targetSpace.items.length + 1
            };

            return {
                ...prev,
                [targetSpaceId]: {
                    ...targetSpace,
                    items: [...targetSpace.items, newItemInFolder]
                },
                [activeSpaceId]: {
                    ...currentSpace,
                    items: [...remainingItems, targetItem], // Source removed, target remains
                    connections: remainingConnections
                }
            };
        } 
        
        // Case B: Target is NOT a folder -> Create new Stack (Folder)
        else {
            const newSpaceId = `space-${Date.now()}`;
            const newFolderId = `folder-${Date.now()}`;
            
            const folderItem: SpatialItem = {
                id: newFolderId,
                type: 'folder',
                x: targetItem.x, // Position at target location
                y: targetItem.y,
                w: 200,
                h: 240,
                zIndex: Math.max(sourceItem.zIndex, targetItem.zIndex),
                rotation: 0,
                content: 'Stack',
                linkedSpaceId: newSpaceId
            };

            const newSpace: Space = {
                id: newSpaceId,
                name: 'Stack',
                parentId: activeSpaceId,
                camera: { x: 0, y: 0, zoom: 1 },
                items: [
                    { ...targetItem, x: -20, y: -20, zIndex: 1 },
                    { ...sourceItem, x: 20, y: 20, zIndex: 2 }
                ],
                connections: []
            };

            return {
                ...prev,
                [newSpaceId]: newSpace,
                [activeSpaceId]: {
                    ...currentSpace,
                    items: [...remainingItems, folderItem],
                    connections: remainingConnections
                }
            };
        }
    });
    setSelection(new Set()); // Reset selection after stack op
  }, [activeSpaceId]);


  // Auto Layout Logic
  const handleAutoLayout = useCallback(async () => {
    if (isLayouting || activeSpace.items.length === 0) return;
    setIsLayouting(true);

    try {
      // Construct ELK graph
      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'rectpacking',
          'elk.spacing.nodeNode': '40', // Spacing between items
          'elk.aspectRatio': '1.6', // Target aspect ratio for the packing
        },
        children: activeSpace.items.map(item => ({
          id: item.id,
          width: item.w,
          height: item.h,
        }))
      };

      const layoutedGraph = await elk.layout(graph);

      if (layoutedGraph.children) {
        const newItems = activeSpace.items.map(item => {
          const node = layoutedGraph.children?.find(n => n.id === item.id);
          if (node) {
            return {
              ...item,
              x: node.x || 0,
              y: node.y || 0
            };
          }
          return item;
        });
        
        // 1. Update items
        updateItems(newItems);
        
        // 2. Fit camera to new layout
        const fitParams = getFitToViewParams(newItems);
        setCameraOverride({ ...fitParams, id: Date.now().toString() });
      }
    } catch (err) {
      console.error("Auto layout failed:", err);
    } finally {
      setIsLayouting(false);
    }
  }, [activeSpace.items, isLayouting, updateItems]);

  // Navigation Logic
  const handleNavigate = (targetSpaceId: string) => {
    if (spaces[targetSpaceId]) {
      const targetSpace = spaces[targetSpaceId];

      setActiveSpaceId(targetSpaceId);
      setSelection(new Set());

      // Force camera fit AFTER Canvas remounts
      if (targetSpace.items.length > 0) {
        setTimeout(() => {
          const fitParams = getFitToViewParams(targetSpace.items);
          setCameraOverride({ ...fitParams, id: Date.now().toString() });
        }, 0);
      }
    }
  };

  const handleBack = () => {
    if (activeSpace.parentId) {
      const parentId = activeSpace.parentId;
      const parentSpace = spaces[parentId];

      setActiveSpaceId(parentId);
      setSelection(new Set());

      // Force camera fit AFTER Canvas remounts
      if (parentSpace && parentSpace.items.length > 0) {
        setTimeout(() => {
          const fitParams = getFitToViewParams(parentSpace.items);
          setCameraOverride({ ...fitParams, id: Date.now().toString() });
        }, 0);
      }
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAIModal) {
          setShowAIModal(false);
        } else if (mediaViewerItem) {
          setMediaViewerItem(null);
        } else if (selection.size > 0) {
            setSelection(new Set());
        } else if (activeSpace.parentId) {
          handleBack();
        }
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && selection.size > 0) {
          // Check if not editing text
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && !(document.activeElement as HTMLElement)?.isContentEditable) {
             handleDeleteItems(selection);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpace, mediaViewerItem, selection, handleDeleteItems, showAIModal]);

  return (
    <div className="relative w-full h-full bg-gray-50 overflow-hidden text-gray-900">
      
      {/* Persistent Navigation (Top Left) */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        {activeSpace.parentId && (
          <button 
            onClick={handleBack}
            className="p-2 bg-white/80 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors border border-gray-100"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
        )}
        <div className="px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-gray-100 font-semibold text-sm text-gray-700 select-none">
          {activeSpace.name}
        </div>
      </div>

      {/* Main Canvas */}
      <div 
        key={activeSpaceId} 
        className="w-full h-full animate-space-enter"
      >
        <Canvas 
            items={activeSpace.items}
            connections={activeSpace.connections || []}
            initialCamera={activeSpace.camera}
            cameraOverride={cameraOverride}
            selection={selection}
            onSelectionChange={setSelection}
            onUpdateItems={updateItems}
            onNavigate={handleNavigate}
            onOpenMedia={(item, rect) => {
              setMediaViewerRect(rect);
              setMediaViewerItem(item);
            }}
            getSpaceItems={getSpaceItems}
            onStackItems={handleStackItems}
            onConnect={handleConnect}
            onDeleteConnection={handleDeleteConnection}
            onDropFiles={handleDropFiles}
        />
      </div>

      {/* Slide-up Context Toolbar */}
      <ContextToolbar
          selection={selection}
          items={activeSpace.items}
          onUpdateItem={handleUpdateItem}
          onDelete={handleDeleteItems}
          onGroupToStack={handleGroupToStack}
          onUngroup={handleUngroup}
      />

      {/* Creation Toolbar (Bottom Right) */}
      <Toolbar 
        onAddItem={(type) => {
          const newItem: SpatialItem = {
            id: Date.now().toString(),
            type,
            x: -window.innerWidth/2 * 0.1, // Roughly center
            y: 0,
            w: type === 'sticky' ? 200 : type === 'folder' ? 200 : 300,
            h: type === 'sticky' ? 200 : type === 'folder' ? 240 : 200,
            zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
            rotation: (Math.random() - 0.5) * 6, // Random rotation between -3 and 3 degrees
            content: type === 'sticky' ? 'New thought...' : type === 'folder' ? 'New Space' : type === 'image' ? 'https://picsum.photos/400/300' : '<p>New Note</p>',
            color: type === 'sticky' ? 'bg-yellow-200' : undefined,
            linkedSpaceId: type === 'folder' ? `space-${Date.now()}` : undefined
          };

          if (type === 'folder') {
             // Create the new space for the folder
             setSpaces(prev => ({
                 ...prev,
                 [newItem.linkedSpaceId!]: {
                     id: newItem.linkedSpaceId!,
                     name: 'New Space',
                     parentId: activeSpaceId,
                     items: [],
                     connections: [],
                     camera: { x: 0, y: 0, zoom: 1 }
                 }
             }));
          }

          updateItems([...activeSpace.items, newItem]);
        }}
        onAutoLayout={handleAutoLayout}
        isLayouting={isLayouting}
        onOpenAI={() => setShowAIModal(true)}
      />

      {/* AI Modal */}
      {showAIModal && (
        <AIModal 
          onClose={() => setShowAIModal(false)}
          onGenerate={(type, content, metadata) => {
             const newItem: SpatialItem = {
                id: Date.now().toString(),
                type,
                x: -window.innerWidth/2 * 0.1 + (Math.random() * 40 - 20),
                y: 0 + (Math.random() * 40 - 20),
                w: type === 'sticky' ? 200 : 300,
                h: type === 'sticky' ? 200 : type === 'image' || type === 'video' ? 300 : 300,
                zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                rotation: (Math.random() - 0.5) * 4,
                content: content,
                color: type === 'sticky' ? 'bg-blue-100' : undefined,
                metadata: metadata
             };
             updateItems([...activeSpace.items, newItem]);
          }}
        />
      )}

      {/* Media Viewer Modal */}
      {mediaViewerItem && (
        <MediaViewer
          item={mediaViewerItem}
          sourceRect={mediaViewerRect}
          onClose={() => {
            setMediaViewerItem(null);
            setMediaViewerRect(null);
          }}
          onCreateVariant={handleCreateVariant}
        />
      )}
    </div>
  );
};

export default App;