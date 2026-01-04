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
        x: 100,
        y: 100,
        w: 320,
        h: 400,
        zIndex: 1,
        rotation: -1.2,
        content: `<h1>Welcome to Spatial Alpha</h1><p>This is an "open air space" for thinking.</p><ul><li>Drag items to move them.</li><li>Double-click a folder to enter.</li><li>Double-click media to view.</li><li>Double-click a note to edit.</li><li>Scroll to pan, Ctrl+Scroll to zoom.</li></ul>`,
      },
      {
        id: '2',
        type: 'sticky',
        x: 500,
        y: 150,
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
        x: 150,
        y: 600,
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
        x: 600,
        y: 500,
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
        x: 850,
        y: 100,
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
        x: 50,
        y: 50,
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
        x: 300,
        y: 50,
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
    setSelection(new Set()); // Clear selection after delete
  }, [activeSpaceId]);

  const getSpaceItems = useCallback((spaceId: string) => {
    return spaces[spaceId]?.items || [];
  }, [spaces]);

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
      
      // Calculate fit bounds for the target space if it has items
      // This ensures we always "see" the content when entering
      if (targetSpace.items.length > 0) {
          const fitParams = getFitToViewParams(targetSpace.items);
          
          setSpaces(prev => ({
              ...prev,
              [targetSpaceId]: {
                  ...prev[targetSpaceId],
                  camera: fitParams
              }
          }));
      }

      setActiveSpaceId(targetSpaceId);
      setSelection(new Set()); // Clear selection on navigate
    }
  };

  const handleBack = () => {
    if (activeSpace.parentId) {
      setActiveSpaceId(activeSpace.parentId);
      setSelection(new Set());
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
            onOpenMedia={setMediaViewerItem}
            getSpaceItems={getSpaceItems}
            onStackItems={handleStackItems}
            onConnect={handleConnect}
        />
      </div>

      {/* Slide-up Context Toolbar */}
      <ContextToolbar 
          selection={selection} 
          items={activeSpace.items}
          onUpdateItem={handleUpdateItem}
          onDelete={handleDeleteItems}
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
        <MediaViewer item={mediaViewerItem} onClose={() => setMediaViewerItem(null)} />
      )}
    </div>
  );
};

export default App;