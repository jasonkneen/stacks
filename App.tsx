import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas } from './components/Canvas';
import { ContextToolbar } from './components/ContextToolbar';
import { MediaViewer } from './components/MediaViewer';
import { NoteViewer } from './components/NoteViewer';
import { AIModal } from './components/AIModal';
import { NameEditor } from './components/NameEditor';
import { SpaceOverview } from './components/SpaceOverview';
import { SettingsModal } from './components/SettingsModal';
import { AIPromptPopup } from './components/AIPromptPopup';
import { AutoArrangeButton } from './components/AutoArrangeButton';
import { useAutoSave } from './hooks/useAutoSave';
import { useMCPClient } from './hooks/useMCPClient';
import { loadSpaces, saveSpaces } from './utils/storage';
import { Space, SpatialItem, Connection, LayoutType, SortOption } from './types';
import { ArrowLeft, Menu, Plus, StickyNote, Type, Image as ImageIcon, FolderPlus, X, LayoutGrid, Zap, Settings } from 'lucide-react';
import ELK from 'elkjs';
import { analyzeImage } from './utils/imageAnalysis';

// Blank canvas on first load
const ROOT_SPACE_ID = 'root';
const INITIAL_SPACES: Record<string, Space> = {
  [ROOT_SPACE_ID]: {
    id: ROOT_SPACE_ID,
    name: 'Scratchpad',
    parentId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    items: [],
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
  // Load from localStorage or use initial data
  const [spaces, setSpacesRaw] = useState<Record<string, Space>>(INITIAL_SPACES);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);

  // Wrap setSpaces to log all state changes and track item counts
  const setSpaces = useCallback((update: any) => {
    setSpacesRaw(prev => {
      const newState = typeof update === 'function' ? update(prev) : update;
      const prevCount = Object.values(prev).reduce((sum, s) => sum + s.items.length, 0);
      const newCount = Object.values(newState).reduce((sum, s) => sum + s.items.length, 0);

      if (prevCount !== newCount) {
        const stack = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
        console.log('[App] setSpaces - item count changed:', {
          from: prevCount,
          to: newCount,
          diff: newCount - prevCount,
          caller: stack.substring(stack.lastIndexOf('/') + 1, stack.indexOf(')'))
        });
      }

      return newState;
    });
  }, []);

  // Load saved spaces asynchronously on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Check if localStorage is corrupted
        const testKey = 'scratchpad-test';
        try {
          localStorage.setItem(testKey, 'test');
          localStorage.removeItem(testKey);
        } catch (e) {
          // localStorage full - clear it
          console.warn('[App] localStorage full, clearing old data...');
          localStorage.clear();
        }

        const saved = await loadSpaces();
        if (saved) {
          console.log('[App] Setting initial spaces from saved data');
          setSpaces(saved);
        } else {
          console.log('[App] No saved data, using INITIAL_SPACES');
        }
      } catch (error) {
        console.error('[App] Failed to load spaces:', error);
      } finally {
        setIsLoadingSpaces(false);
      }
    };

    init();
  }, []);

  const [activeSpaceId, setActiveSpaceId] = useState<string>(ROOT_SPACE_ID);

  // Autosave enabled
  useAutoSave(spaces, true);
  const [mediaViewerItem, setMediaViewerItem] = useState<SpatialItem | null>(null);
  const [mediaViewerRect, setMediaViewerRect] = useState<DOMRect | null>(null);
  const [noteViewerItem, setNoteViewerItem] = useState<SpatialItem | null>(null);
  const [noteViewerRect, setNoteViewerRect] = useState<DOMRect | null>(null);
  const [isLayouting, setIsLayouting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showAIModal, setShowAIModal] = useState(false);
  const [editingFolderItem, setEditingFolderItem] = useState<SpatialItem | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiPromptState, setAIPromptState] = useState<{ itemId: string; position: { x: number; y: number } } | null>(null);

  // MCP Client for AI tools
  const mcp = useMCPClient({ autoConnect: true });

  // To trigger camera moves programmatically in Canvas
  const [cameraOverride, setCameraOverride] = useState<{ x: number, y: number, zoom: number, id: string } | undefined>(undefined);

  // Safety check: ensure spaces is valid and has activeSpaceId
  const activeSpace = spaces?.[activeSpaceId] || INITIAL_SPACES[ROOT_SPACE_ID];

  // Get top-level spaces (no parent) for horizontal navigation
  const topLevelSpaces = useMemo(() => {
    if (!spaces) return [INITIAL_SPACES[ROOT_SPACE_ID]];
    return Object.values(spaces).filter(s => s?.parentId === null);
  }, [spaces]);

  // Helper to update items in the current space
  // Accepts either a full array OR a function that transforms current items
  // Using function form prevents stale closure bugs (e.g., Canvas using old items after delete)
  const updateItems = useCallback((updater: SpatialItem[] | ((currentItems: SpatialItem[]) => SpatialItem[])) => {
    setSpaces(prev => {
      const currentItems = prev[activeSpaceId]?.items || [];
      const newItems = typeof updater === 'function' ? updater(currentItems) : updater;
      return {
        ...prev,
        [activeSpaceId]: {
          ...prev[activeSpaceId],
          items: newItems,
        }
      };
    });
  }, [activeSpaceId]);

  // Helper to analyze an image and update its metadata
  const analyzeAndUpdateImage = useCallback(async (itemId: string, imageUrl: string, spaceId?: string) => {
    const targetSpaceId = spaceId || activeSpaceId;

    // Mark as analyzing
    setSpaces(prev => ({
      ...prev,
      [targetSpaceId]: {
        ...prev[targetSpaceId],
        items: prev[targetSpaceId].items.map(item =>
          item.id === itemId
            ? { ...item, metadata: { ...item.metadata, isAnalyzing: true } }
            : item
        )
      }
    }));

    // Run analysis
    const analysis = await analyzeImage(imageUrl);

    // Update with results
    setSpaces(prev => {
      const itemExists = prev[targetSpaceId]?.items.some(i => i.id === itemId);
      if (!itemExists) {
        console.log('[App] Image item was deleted during analysis, skipping update');
        return prev;
      }

      return {
        ...prev,
        [targetSpaceId]: {
          ...prev[targetSpaceId],
          items: prev[targetSpaceId].items.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  metadata: {
                    ...item.metadata,
                    description: analysis.description,
                    colors: analysis.colors,
                    isAnalyzing: false
                  }
                }
              : item
          )
        }
      };
    });
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
    console.log('[App] Deleting items:', {
      itemIds: Array.from(ids),
      count: ids.size,
      spaceId: activeSpaceId
    });

    setSpaces(prev => {
        const space = prev[activeSpaceId];
        const beforeCount = space.items.length;
        const newItems = space.items.filter(i => !ids.has(i.id));
        const afterCount = newItems.length;
        // Remove connections attached to deleted items
        const newConnections = (space.connections || []).filter(c => !ids.has(c.from) && !ids.has(c.to));

        console.log('[App] Delete complete:', {
          beforeCount,
          afterCount,
          deleted: beforeCount - afterCount
        });

        const newSpaces = {
            ...prev,
            [activeSpaceId]: {
                ...space,
                items: newItems,
                connections: newConnections
            }
        };

        // CRITICAL: Save IMMEDIATELY on delete
        // This prevents any other operations from restoring the deleted items
        console.log('[App] IMMEDIATE save after delete');
        saveSpaces(newSpaces).catch(err => console.error('[App] Delete save failed:', err));

        return newSpaces;
    });
    setSelection(new Set());
  }, [activeSpaceId]);

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
  }, [activeSpaceId]);

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
  }, [activeSpaceId]);

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

      // Analyze images in the stack
      stackItems.forEach(item => {
        if (item.type === 'image') {
          analyzeAndUpdateImage(item.id, item.content, newSpaceId);
        }
      });
    } else if (newItems.length === 1) {
      // Single file, just add it
      updateItems([...spaces[activeSpaceId].items, newItems[0]]);

      // Analyze if it's an image
      if (newItems[0].type === 'image') {
        analyzeAndUpdateImage(newItems[0].id, newItems[0].content);
      }
    }
  }, [activeSpaceId, spaces, updateItems, analyzeAndUpdateImage]);

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

  // Handle AI-generated content from connection handle
  const handleAIGeneration = useCallback(async (sourceItemId: string, prompt: string) => {
    const sourceItem = activeSpace.items.find(i => i.id === sourceItemId);
    if (!sourceItem) return;

    // Create new note item positioned near the source
    const newItemId = `ai-${Date.now()}`;
    const newItem: SpatialItem = {
      id: newItemId,
      type: 'note',
      x: sourceItem.x + sourceItem.w + 100,
      y: sourceItem.y,
      w: 320,
      h: 400,
      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
      rotation: (Math.random() - 0.5) * 4,
      content: '<p>Generating...</p>',
      metadata: { isGenerating: true, prompt }
    };

    // Add item and connection
    setSpaces(prev => ({
      ...prev,
      [activeSpaceId]: {
        ...prev[activeSpaceId],
        items: [...prev[activeSpaceId].items, newItem],
        connections: [
          ...(prev[activeSpaceId].connections || []),
          {
            id: `conn-${Date.now()}`,
            from: sourceItemId,
            to: newItemId
          }
        ]
      }
    }));

    try {
      // Use AI provider with MCP tools when available
      const { generateTextStream, generateWithTools } = await import('./utils/aiProvider');

      const contextText = sourceItem.content.replace(/<[^>]*>/g, ' ').trim();
      const hasTools = mcp.connected && mcp.tools.length > 0;

      // Build tool definitions for Gemini
      const toolDefs = hasTools ? mcp.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        serverId: t.serverId,
      })) : [];

      // Tool call handler
      const handleToolCall = async (serverId: string, toolName: string, args: Record<string, any>) => {
        const result = await mcp.callTool(serverId, toolName, args);
        if (result?.content) {
          return result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        }
        return JSON.stringify(result);
      };

      let fullContent = '';

      const updateContent = (chunk: string) => {
        fullContent += chunk;

        // Strip markdown code fences if present
        let cleanedContent = fullContent
          .replace(/^```html\s*/i, '')
          .replace(/^```\s*/m, '')
          .replace(/\s*```$/m, '');

        setSpaces(prev => {
          // Check if item still exists (may have been deleted during generation)
          const itemExists = prev[activeSpaceId].items.some(i => i.id === newItemId);
          if (!itemExists) {
            console.log('[App] AI generation item was deleted, skipping update');
            return prev; // Don't update if item was deleted
          }

          return {
            ...prev,
            [activeSpaceId]: {
              ...prev[activeSpaceId],
              items: prev[activeSpaceId].items.map(item =>
                item.id === newItemId
                  ? { ...item, content: cleanedContent }
                  : item
              )
            }
          };
        });
      };

      if (hasTools) {
        // Use tool-enabled generation
        const systemPrompt = `You are an AI assistant with access to external tools. Use them when helpful to answer the user's request. Available tools: ${mcp.tools.map(t => t.name).join(', ')}.`;

        await generateWithTools(
          `Context: "${contextText}"\n\nUser request: ${prompt}\n\nRespond in HTML format with proper paragraph tags.`,
          toolDefs,
          handleToolCall,
          updateContent,
          { systemPrompt, maxToolCalls: 5 }
        );
      } else {
        // Fallback to simple streaming
        const fullPrompt = `Based on the context: "${contextText}"

User request: ${prompt}

Please provide a thoughtful response in HTML format with proper paragraph tags.`;

        await generateTextStream(fullPrompt, updateContent, {});
      }

      // Mark as complete
      setSpaces(prev => {
        const itemExists = prev[activeSpaceId].items.some(i => i.id === newItemId);
        if (!itemExists) {
          console.log('[App] AI generation item was deleted, skipping completion update');
          return prev;
        }

        return {
          ...prev,
          [activeSpaceId]: {
            ...prev[activeSpaceId],
            items: prev[activeSpaceId].items.map(item =>
              item.id === newItemId
                ? { ...item, metadata: { ...item.metadata, isGenerating: false, usedTools: hasTools } }
                : item
            )
          }
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AI generation failed:', errorMessage, error);

      // Update with detailed error message
      setSpaces(prev => {
        const itemExists = prev[activeSpaceId].items.some(i => i.id === newItemId);
        if (!itemExists) {
          console.log('[App] AI generation item was deleted, skipping error update');
          return prev;
        }

        return {
          ...prev,
          [activeSpaceId]: {
            ...prev[activeSpaceId],
            items: prev[activeSpaceId].items.map(item =>
              item.id === newItemId
                ? {
                    ...item,
                    content: `<p>AI generation failed: ${errorMessage}</p>`,
                    metadata: { ...item.metadata, isGenerating: false }
                  }
                : item
            )
          }
        };
      });
    }
  }, [activeSpaceId, activeSpace.items, mcp.connected, mcp.tools, mcp.callTool]);

  // Handle folder name save
  const handleSaveFolderName = useCallback((newName: string) => {
    if (!editingFolderItem) return;

    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const updatedItems = space.items.map(item =>
        item.id === editingFolderItem.id ? { ...item, content: newName } : item
      );

      // Also update linked space name if exists
      const linkedSpaceId = editingFolderItem.linkedSpaceId;
      if (linkedSpaceId && prev[linkedSpaceId]) {
        return {
          ...prev,
          [activeSpaceId]: { ...space, items: updatedItems },
          [linkedSpaceId]: { ...prev[linkedSpaceId], name: newName }
        };
      }

      return {
        ...prev,
        [activeSpaceId]: { ...space, items: updatedItems }
      };
    });

    setEditingFolderItem(null);
  }, [activeSpaceId, editingFolderItem]);

  // Handle space name save
  const handleSaveSpaceName = useCallback((newName: string) => {
    setSpaces(prev => ({
      ...prev,
      [activeSpaceId]: {
        ...prev[activeSpaceId],
        name: newName
      }
    }));
    setEditingSpaceName(false);
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


  // Auto Arrange Logic
  const handleAutoArrange = useCallback((layoutType: LayoutType, sortBy: SortOption, selectedIds: Set<string>) => {
    if (activeSpace.items.length === 0) return;

    // Import arrangement functions from Canvas
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

    const arrangeGrid = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
      if (items.length === 0) return items;
      const sorted = sortItems(items, sortBy);
      const GRID_GAP = 40;
      const ITEM_SIZE = 220;
      const COLS = Math.ceil(Math.sqrt(items.length * 1.5));
      const rows = Math.ceil(items.length / COLS);
      const totalWidth = COLS * ITEM_SIZE + (COLS - 1) * GRID_GAP;
      const totalHeight = rows * ITEM_SIZE + (rows - 1) * GRID_GAP;
      const startX = -totalWidth / 2;
      const startY = -totalHeight / 2;
      return sorted.map((item, index) => {
        const col = index % COLS;
        const row = Math.floor(index / COLS);
        return {
          ...item,
          x: startX + col * (ITEM_SIZE + GRID_GAP),
          y: startY + row * (ITEM_SIZE + GRID_GAP),
          w: ITEM_SIZE,
          h: ITEM_SIZE,
          rotation: 0,
        };
      });
    };

    const arrangeBento = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
      if (items.length === 0) return items;
      const sorted = sortItems(items, sortBy);
      const GAP = 20;
      const SMALL = 180;
      const LARGE = 380;
      const COLS = 3;
      const colHeights = new Array(COLS).fill(0);
      const arranged = sorted.map((item, index) => {
        const isLarge = index % 4 === 0;
        const w = isLarge ? LARGE : SMALL;
        const h = isLarge ? LARGE : SMALL;
        const minHeight = Math.min(...colHeights);
        const col = colHeights.indexOf(minHeight);
        const x = -((COLS * SMALL + (COLS - 1) * GAP) / 2) + col * (SMALL + GAP);
        const y = colHeights[col];
        colHeights[col] += h + GAP;
        return { ...item, x, y, w, h, rotation: 0 };
      });
      const maxHeight = Math.max(...colHeights);
      return arranged.map(item => ({ ...item, y: item.y - maxHeight / 2 }));
    };

    const arrangeRandom = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
      if (items.length === 0) return items;
      const sorted = sortItems(items, sortBy);
      const SPREAD = 400;
      const SIZE_MIN = 160;
      const SIZE_MAX = 280;
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
          rotation: (seededRandom() - 0.5) * 10,
        };
      });
    };

    // Apply layout based on type
    const layout = layoutType === 'grid' ? arrangeGrid :
                   layoutType === 'bento' ? arrangeBento : arrangeRandom;

    // Determine which items to arrange
    const itemsToArrange = selectedIds.size > 0
      ? activeSpace.items.filter(item => selectedIds.has(item.id))
      : activeSpace.items;

    const otherItems = selectedIds.size > 0
      ? activeSpace.items.filter(item => !selectedIds.has(item.id))
      : [];

    // Arrange selected/all items
    const arranged = layout(itemsToArrange, sortBy);

    // Combine arranged items with others
    const newItems = [...arranged, ...otherItems];

    // Update items
    updateItems(newItems);

    // Update space preferences
    setSpaces(prev => ({
      ...prev,
      [activeSpaceId]: {
        ...prev[activeSpaceId],
        layoutType,
        sortBy
      }
    }));

    // Fit camera to arranged bounds
    const fitParams = getFitToViewParams(arranged);
    setCameraOverride({ ...fitParams, id: Date.now().toString() });
  }, [activeSpace.items, activeSpaceId, updateItems]);

  // Navigation Logic
  const handleNavigate = (targetSpaceId: string) => {
    if (spaces[targetSpaceId]) {
      setActiveSpaceId(targetSpaceId);
      setSelection(new Set());
    }
  };

  const handleBack = () => {
    if (activeSpace.parentId) {
      const parentId = activeSpace.parentId;
      setActiveSpaceId(parentId);
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
        } else if (noteViewerItem) {
          setNoteViewerItem(null);
          setNoteViewerRect(null);
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
      } else if (e.key === 'ArrowLeft' && e.metaKey && topLevelSpaces.length > 1) {
          // Navigate to previous space
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            const currentIndex = topLevelSpaces.findIndex(s => s.id === activeSpaceId);
            if (currentIndex > 0) {
              const prevSpace = topLevelSpaces[currentIndex - 1];
              setActiveSpaceId(prevSpace.id);
              setSelection(new Set());
            }
          }
      } else if (e.key === 'ArrowRight' && e.metaKey && topLevelSpaces.length > 1) {
          // Navigate to next space
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            const currentIndex = topLevelSpaces.findIndex(s => s.id === activeSpaceId);
            if (currentIndex < topLevelSpaces.length - 1) {
              const nextSpace = topLevelSpaces[currentIndex + 1];
              setActiveSpaceId(nextSpace.id);
              setSelection(new Set());
            }
          }
      } else if (e.key === 'o' && e.metaKey && topLevelSpaces.length > 1) {
          // Toggle overview mode with Cmd+O
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            e.preventDefault();
            setShowOverview(prev => !prev);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpace, mediaViewerItem, noteViewerItem, selection, handleDeleteItems, showAIModal, topLevelSpaces, activeSpaceId]);

  return (
    <div className="relative w-full h-full overflow-hidden text-gray-900" style={{
      backgroundColor: '#f8f7f4',
      backgroundImage: `
        repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.015) 3px),
        repeating-linear-gradient(90deg, rgba(0,0,0,0.015) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.015) 3px),
        repeating-linear-gradient(45deg, transparent 0px, transparent 2px, rgba(0,0,0,0.008) 2px, rgba(0,0,0,0.008) 3px)
      `
    }}>
      
      {/* Persistent Navigation (Top Left) - Hidden in overview */}
      {!showOverview && (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          {activeSpace.parentId && (
            <button
              onClick={handleBack}
              className="p-2 bg-white/40 backdrop-blur-md rounded-full shadow-lg hover:bg-white/50 transition-colors border border-white/60"
            >
              <ArrowLeft size={20} className="text-gray-800" />
            </button>
          )}
          <div
            className="px-5 py-2.5 bg-white/40 backdrop-blur-md rounded-full shadow-lg border border-white/60 font-semibold text-sm text-gray-800 select-none cursor-pointer hover:bg-white/50 transition-colors"
            onDoubleClick={() => setEditingSpaceName(true)}
            title="Double-click to rename"
          >
            {activeSpace.name}
          </div>

          {/* Toggle Overview Button */}
          {topLevelSpaces.length > 1 && (
            <button
              onClick={() => setShowOverview(true)}
              className="p-2 bg-white/40 backdrop-blur-md rounded-full shadow-lg hover:bg-white/50 transition-colors border border-white/60"
              title="Show all spaces (⌘O)"
            >
              <Menu size={20} className="text-gray-800" />
            </button>
          )}
        </div>
      )}

      {/* Auto Arrange Button - Top Center */}
      {!showOverview && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <AutoArrangeButton
            layoutType={activeSpace.layoutType || 'grid'}
            sortBy={activeSpace.sortBy || 'updated'}
            onLayoutChange={(layout) => {
              setSpaces(prev => ({
                ...prev,
                [activeSpaceId]: {
                  ...prev[activeSpaceId],
                  layoutType: layout
                }
              }));
            }}
            onSortChange={(sort) => {
              setSpaces(prev => ({
                ...prev,
                [activeSpaceId]: {
                  ...prev[activeSpaceId],
                  sortBy: sort
                }
              }));
            }}
            onArrange={() => handleAutoArrange(
              activeSpace.layoutType || 'grid',
              activeSpace.sortBy || 'updated',
              selection
            )}
            hasSelection={selection.size > 0}
          />
        </div>
      )}

      {/* Main View - Canvas or Overview */}
      {showOverview ? (
        <SpaceOverview
          spaces={topLevelSpaces}
          activeSpaceId={activeSpaceId}
          onSelectSpace={(spaceId) => {
            setActiveSpaceId(spaceId);
            setShowOverview(false);
            setSelection(new Set());
          }}
          onCreateSpace={() => {
            const newSpaceId = `space-${Date.now()}`;
            setSpaces(prev => ({
              ...prev,
              [newSpaceId]: {
                id: newSpaceId,
                name: 'New Space',
                parentId: null,
                items: [],
                connections: [],
                camera: { x: 0, y: 0, zoom: 1 }
              }
            }));
            setActiveSpaceId(newSpaceId);
            setShowOverview(false);
            setSelection(new Set());
          }}
        />
      ) : (
        <div className="w-full h-full">
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
              onOpenNote={(item, rect) => {
                setNoteViewerRect(rect);
                setNoteViewerItem(item);
              }}
              onEditFolderName={setEditingFolderItem}
              getSpaceItems={getSpaceItems}
              onStackItems={handleStackItems}
              onConnect={handleConnect}
              onDeleteConnection={handleDeleteConnection}
              onDropFiles={handleDropFiles}
              onMarkManuallyPositioned={(ids) => {
                const updatedItems = activeSpace.items.map(item =>
                  ids.includes(item.id)
                    ? { ...item, metadata: { ...item.metadata, manuallyPositioned: true } }
                    : item
                );
                updateItems(updatedItems);
              }}
              onAIPromptStart={(itemId, position) => {
                setAIPromptState({ itemId, position });
              }}
              onCameraChange={(camera) => {
                setSpaces(prev => ({
                  ...prev,
                  [activeSpaceId]: {
                    ...prev[activeSpaceId],
                    camera
                  }
                }));
              }}
          />
        </div>
      )}

      {/* Slide-up Context Toolbar */}
      {!showOverview && (
        <ContextToolbar
          selection={selection}
          items={activeSpace.items}
          onUpdateItem={handleUpdateItem}
          onDelete={handleDeleteItems}
          onGroupToStack={handleGroupToStack}
          onUngroup={handleUngroup}
        />
      )}

      {/* Space Navigation + Actions - Bottom Right */}
      {!showOverview && (
        <div className="absolute bottom-8 right-8 flex items-center gap-3 z-50">
          {/* AI Studio Button */}
          <button
            className="bg-blue-500/80 backdrop-blur-md p-3.5 rounded-2xl hover:bg-blue-500/90 text-white transition-all shadow-lg hover:scale-105 active:scale-95 border border-blue-400/40"
            onClick={() => setShowAIModal(true)}
            title="AI Studio"
          >
            <Zap size={20} fill="currentColor" />
          </button>

          {/* New Space Button */}
          <button
            className="bg-white/40 backdrop-blur-md p-3.5 rounded-2xl hover:bg-white/50 text-gray-800 transition-all shadow-lg hover:scale-105 active:scale-95 border border-white/60"
            onClick={() => {
              const newSpaceId = `space-${Date.now()}`;
              setSpaces(prev => ({
                ...prev,
                [newSpaceId]: {
                  id: newSpaceId,
                  name: 'New Space',
                  parentId: null,
                  items: [],
                  connections: [],
                  camera: { x: 0, y: 0, zoom: 1 }
                }
              }));
              setActiveSpaceId(newSpaceId);
              setSelection(new Set());
            }}
            title="New Space"
          >
            <FolderPlus size={20} />
          </button>

          {/* Space Indicator */}
          {topLevelSpaces.length > 1 && (
            <div className="bg-white/40 backdrop-blur-md rounded-full px-2 py-1.5 shadow-lg border border-white/60">
              <div className="flex items-center gap-2">
                {/* Previous button */}
                <button
                  onClick={() => {
                    const currentIndex = topLevelSpaces.findIndex(s => s.id === activeSpaceId);
                    if (currentIndex > 0) {
                      const prevSpace = topLevelSpaces[currentIndex - 1];
                      setActiveSpaceId(prevSpace.id);
                      setSelection(new Set());
                    }
                  }}
                  disabled={topLevelSpaces.findIndex(s => s.id === activeSpaceId) === 0}
                  className={`p-2 rounded-full transition-all ${
                    topLevelSpaces.findIndex(s => s.id === activeSpaceId) === 0
                      ? 'opacity-0 cursor-not-allowed'
                      : 'hover:bg-gray-800/10 text-gray-800 shadow-lg'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>

                {/* Space dots */}
                <div className="flex items-center gap-1.5 px-2">
                  {topLevelSpaces.map((space) => (
                    <button
                      key={space.id}
                      onClick={() => {
                        setActiveSpaceId(space.id);
                        setSelection(new Set());
                      }}
                      className={`transition-all duration-300 rounded-full ${
                        space.id === activeSpaceId
                          ? 'w-6 h-1.5 bg-gray-800'
                          : 'w-1.5 h-1.5 bg-gray-600/50 hover:bg-gray-700/70'
                      }`}
                      title={space.name}
                    />
                  ))}
                </div>

                {/* Next button */}
                <button
                  onClick={() => {
                    const currentIndex = topLevelSpaces.findIndex(s => s.id === activeSpaceId);
                    if (currentIndex < topLevelSpaces.length - 1) {
                      const nextSpace = topLevelSpaces[currentIndex + 1];
                      setActiveSpaceId(nextSpace.id);
                      setSelection(new Set());
                    }
                  }}
                  disabled={topLevelSpaces.findIndex(s => s.id === activeSpaceId) === topLevelSpaces.length - 1}
                  className={`p-2 rounded-full transition-all ${
                    topLevelSpaces.findIndex(s => s.id === activeSpaceId) === topLevelSpaces.length - 1
                      ? 'opacity-0 cursor-not-allowed'
                      : 'hover:bg-gray-800/10 text-gray-800 shadow-lg'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Add Button with Menu */}
          <div className="relative">
            {/* Add Menu Dropdown */}
            {showAddMenu && (
              <div className="absolute bottom-16 right-0 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 p-2 flex flex-col gap-1 min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    const now = Date.now();
                    const newItem: SpatialItem = {
                      id: now.toString(),
                      type: 'sticky',
                      x: -window.innerWidth/2 * 0.1,
                      y: 0,
                      w: 200,
                      h: 200,
                      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                      rotation: (Math.random() - 0.5) * 6,
                      content: 'New thought...',
                      color: 'bg-yellow-200',
                      metadata: { createdAt: now, updatedAt: now }
                    };
                    updateItems([...activeSpace.items, newItem]);
                    setShowAddMenu(false);
                  }}
                >
                  <StickyNote size={18} />
                  <span className="text-sm">Sticky Note</span>
                </button>
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    const now = Date.now();
                    const newItem: SpatialItem = {
                      id: now.toString(),
                      type: 'note',
                      x: -window.innerWidth/2 * 0.1,
                      y: 0,
                      w: 300,
                      h: 200,
                      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                      rotation: (Math.random() - 0.5) * 6,
                      content: '<p>New Note</p>',
                      metadata: { createdAt: now, updatedAt: now }
                    };
                    updateItems([...activeSpace.items, newItem]);
                    setShowAddMenu(false);
                  }}
                >
                  <Type size={18} />
                  <span className="text-sm">Note</span>
                </button>
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    const now = Date.now();
                    const newItem: SpatialItem = {
                      id: now.toString(),
                      type: 'image',
                      x: -window.innerWidth/2 * 0.1,
                      y: 0,
                      w: 300,
                      h: 200,
                      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                      rotation: (Math.random() - 0.5) * 6,
                      content: 'https://picsum.photos/400/300',
                      metadata: { createdAt: now, updatedAt: now }
                    };
                    updateItems([...activeSpace.items, newItem]);
                    setShowAddMenu(false);
                  }}
                >
                  <ImageIcon size={18} />
                  <span className="text-sm">Image</span>
                </button>
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    const now = Date.now();
                    const newSpaceId = `stack-${now}`;
                    const newItem: SpatialItem = {
                      id: now.toString(),
                      type: 'folder',
                      x: -window.innerWidth/2 * 0.1,
                      y: 0,
                      w: 200,
                      h: 240,
                      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                      rotation: (Math.random() - 0.5) * 6,
                      content: 'Stack',
                      linkedSpaceId: newSpaceId,
                      metadata: { createdAt: now, updatedAt: now }
                    };
                    setSpaces(prev => ({
                      ...prev,
                      [newSpaceId]: {
                        id: newSpaceId,
                        name: 'Stack',
                        parentId: activeSpaceId,
                        items: [],
                        connections: [],
                        camera: { x: 0, y: 0, zoom: 1 }
                      }
                    }));
                    updateItems([...activeSpace.items, newItem]);
                    setShowAddMenu(false);
                  }}
                >
                  <FolderPlus size={18} />
                  <span className="text-sm">Stack</span>
                </button>
              </div>
            )}

            <button
              className={`bg-white/40 backdrop-blur-md border border-white/60 text-gray-800 p-3.5 rounded-full hover:bg-white/50 transition-all shadow-lg hover:scale-105 active:scale-95 ${showAddMenu ? 'rotate-45' : ''}`}
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              {showAddMenu ? <X size={22} /> : <Plus size={22} />}
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close add menu */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAddMenu(false)}
        />
      )}

      {/* Settings Button - Top Right */}
      {!showOverview && (
        <button
          className="absolute top-4 right-4 p-2 bg-white/40 backdrop-blur-md rounded-full shadow-lg hover:bg-white/50 transition-colors border border-white/60 z-50"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <Settings size={20} className="text-gray-800" />
        </button>
      )}

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* AI Prompt Popup (from connection handles) */}
      {aiPromptState && (
        <AIPromptPopup
          position={aiPromptState.position}
          onSubmit={(prompt) => {
            handleAIGeneration(aiPromptState.itemId, prompt);
            setAIPromptState(null);
          }}
          onClose={() => setAIPromptState(null)}
        />
      )}

      {/* AI Modal */}
      {showAIModal && (
        <AIModal
          onClose={() => setShowAIModal(false)}
          onGenerate={(type, content, metadata) => {
             const now = Date.now();
             const newItem: SpatialItem = {
                id: now.toString(),
                type,
                x: -window.innerWidth/2 * 0.1 + (Math.random() * 40 - 20),
                y: 0 + (Math.random() * 40 - 20),
                w: type === 'sticky' ? 200 : 300,
                h: type === 'sticky' ? 200 : type === 'image' || type === 'video' ? 300 : 300,
                zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                rotation: (Math.random() - 0.5) * 4,
                content: content,
                color: type === 'sticky' ? 'bg-blue-100' : undefined,
                metadata: { ...metadata, createdAt: now, updatedAt: now }
             };
             updateItems([...activeSpace.items, newItem]);
          }}
        />
      )}

      {/* Media Viewer Modal */}
      {mediaViewerItem && (() => {
        // Get the current item from the space (might have updated metadata)
        const currentItem = activeSpace.items.find(i => i.id === mediaViewerItem.id) || mediaViewerItem;
        return (
          <MediaViewer
            item={currentItem}
            sourceRect={mediaViewerRect}
            onClose={() => {
              setMediaViewerItem(null);
              setMediaViewerRect(null);
            }}
            onCreateVariant={handleCreateVariant}
            onAnalyze={analyzeAndUpdateImage}
          />
        );
      })()}

      {/* Note Viewer Modal */}
      {noteViewerItem && (
        <NoteViewer
          item={noteViewerItem}
          sourceRect={noteViewerRect}
          onClose={() => {
            setNoteViewerItem(null);
            setNoteViewerRect(null);
          }}
          onUpdateContent={(content) => {
            // Update the note content in the space
            const updatedItems = activeSpace.items.map(item =>
              item.id === noteViewerItem.id ? { ...item, content } : item
            );
            updateItems(updatedItems);
            // Update local reference too
            setNoteViewerItem(prev => prev ? { ...prev, content } : null);
          }}
        />
      )}

      {/* Folder Name Editor */}
      {editingFolderItem && (
        <NameEditor
          initialName={editingFolderItem.content}
          onSave={handleSaveFolderName}
          onCancel={() => setEditingFolderItem(null)}
        />
      )}

      {/* Space Name Editor */}
      {editingSpaceName && (
        <NameEditor
          initialName={activeSpace.name}
          onSave={handleSaveSpaceName}
          onCancel={() => setEditingSpaceName(false)}
        />
      )}
    </div>
  );
};

export default App;