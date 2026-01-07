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
import { AIChat, AIResponse, AIOptions, AI_FORMAT_SYSTEM_PROMPT, parseAIResponse } from './components/AIChat';
import { QuickGenerate } from './components/QuickGenerate';
import { AutoArrangeButton } from './components/AutoArrangeButton';
import { SearchModal } from './components/SearchModal';
import { useAutoSave } from './hooks/useAutoSave';
import { useMCPClient } from './hooks/useMCPClient';
import { useContentZoom } from './hooks/useContentZoom';
import { loadSpaces, saveSpaces } from './utils/storage';
import { getFitToViewParams, getLayoutFunction } from './utils/layouts';
import { Space, SpatialItem, Connection, LayoutType, SortOption, FlowDirection, ItemSpacing } from './types';
import { ArrowLeft, Menu, Plus, StickyNote, Type, Image as ImageIcon, Layers, SquarePlus, X, LayoutGrid, Zap, Settings, Video, Mic, Search } from 'lucide-react';
import ELK from 'elkjs';
import { analyzeImage } from './utils/imageAnalysis';
import { extractImageMetadata, extractVideoMetadata } from './utils/exifExtractor';
import { storeFile, isMediaId, getMediaURL } from './lib/mediaStorage';
import {
  PaperTexture,
  MeshGradient,
  GrainGradient,
  Dithering,
  DotGrid,
  SimplexNoise,
  PerlinNoise,
  Waves,
  Water,
  SmokeRing,
  NeuroNoise,
  DotOrbit,
  Metaballs,
  Voronoi,
  LiquidMetal,
  FlutedGlass,
  GodRays,
  Spiral,
  Swirl,
  Warp,
  ColorPanels,
  StaticMeshGradient,
  StaticRadialGradient,
  PulsingBorder,
  HalftoneDots,
  Heatmap
} from '@paper-design/shaders-react';

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

const App: React.FC = () => {
  const { contentZoom } = useContentZoom();
  
  const [spaces, setSpacesRaw] = useState<Record<string, Space>>(INITIAL_SPACES);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);

  const setSpaces = useCallback((update: Record<string, Space> | ((prev: Record<string, Space>) => Record<string, Space>)) => {
    setSpacesRaw(prev => {
      const newState = typeof update === 'function' ? update(prev) : update;
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
          // Fix items with [NOTE:...] markup that are not type 'note'
          const fixed = Object.fromEntries(
            Object.entries(saved).map(([id, space]) => [
              id,
              {
                ...space,
                items: space.items.map(item => {
                  // If item has [NOTE:...] markup, extract content and convert to note
                  const noteMatch = item.content?.match(/\[NOTE:([^\]]+)\]([\s\S]*?)\[\/NOTE\]/);
                  if (noteMatch) {
                    const title = noteMatch[1];
                    let content = noteMatch[2].trim();

                    // If content doesn't start with heading, prepend title as h1 with spacing
                    if (!content.startsWith('<h1') && !content.startsWith('<h2')) {
                      content = `<h1>${title}</h1>\n\n${content}`;
                    }

                    return {
                      ...item,
                      type: 'note' as const,
                      content,
                      metadata: {
                        ...item.metadata,
                        title
                      }
                    };
                  }
                  return item;
                })
              }
            ])
          );
          setSpaces(fixed);
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
  const [showSearch, setShowSearch] = useState(false);
  const [quickGenerateMode, setQuickGenerateMode] = useState<'image' | 'video' | 'audio' | null>(null);
  const [aiPromptState, setAIPromptState] = useState<{
    itemId?: string;
    itemIds?: Set<string>;
    position: { x: number; y: number };
    mode: 'single' | 'selection';
    targetNodeId?: string; // For smart routing to existing connections
  } | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [contextTip, setContextTip] = useState<string>('Space + Drag to pan');

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

  // Update contextual tip based on selection and layout
  useEffect(() => {
    const layoutType = activeSpace.layoutType || 'grid';
    const count = selection.size;

    if (count === 0) {
      setContextTip('Space + Drag to pan');
    } else if (count === 1) {
      setContextTip('Select 2+ items to arrange');
    } else {
      // 2+ items selected - show arrange tips
      if (layoutType === 'grid') {
        setContextTip('Grid: Snaps items to grid cells with equal spacing');
      } else if (layoutType === 'bento') {
        setContextTip('Bento: Horizontal layout in rows');
      } else if (layoutType === 'random') {
        setContextTip('Random: Scattered arrangement');
      } else {
        setContextTip('Canvas: Free-form positioning');
      }
    }
  }, [selection.size, activeSpace.layoutType]);

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

    // Resolve media ID to actual URL if needed
    let resolvedUrl = imageUrl;
    if (isMediaId(imageUrl)) {
      const objectUrl = await getMediaURL(imageUrl);
      if (!objectUrl) {
        console.error('[App] Failed to resolve media ID:', imageUrl);
        setSpaces(prev => ({
          ...prev,
          [targetSpaceId]: {
            ...prev[targetSpaceId],
            items: prev[targetSpaceId].items.map(item =>
              item.id === itemId
                ? { ...item, metadata: { ...item.metadata, isAnalyzing: false } }
                : item
            )
          }
        }));
        return;
      }
      resolvedUrl = objectUrl;
    }

    // Run analysis
    let analysis;
    try {
      analysis = await analyzeImage(resolvedUrl);
      console.log('[App] Analysis complete:', { colors: analysis.colors.length, hasDescription: !!analysis.description });
    } catch (error) {
      console.error('[App] Analysis failed:', error);
      // Clear analyzing flag on error
      setSpaces(prev => ({
        ...prev,
        [targetSpaceId]: {
          ...prev[targetSpaceId],
          items: prev[targetSpaceId].items.map(item =>
            item.id === itemId
              ? { ...item, metadata: { ...item.metadata, isAnalyzing: false } }
              : item
          )
        }
      }));
      return;
    }

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
    // Helper to read file as data URL (for metadata extraction only)
    const readFileAsDataUrl = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    };

    const newItems: SpatialItem[] = [];
    const baseZIndex = Math.max(...(spaces[activeSpaceId]?.items.map(i => i.zIndex) || [0]), 0);
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');

      // Read as data URL for metadata extraction
      const dataUrl = await readFileAsDataUrl(file);

      // Extract detailed metadata first
      const metadata = isVideo
        ? await extractVideoMetadata(file, dataUrl)
        : await extractImageMetadata(file, dataUrl);

      // Store file in IndexedDB with full metadata
      const mediaId = await storeFile(file, {
        originalName: file.name,
        ...metadata
      });

      newItems.push({
        id: `drop-${now}-${i}`,
        type: isVideo ? 'video' : 'image',
        x: position.x + (i % 3) * 40 - 40,
        y: position.y + Math.floor(i / 3) * 40 - 40,
        w: 300,
        h: isVideo ? 200 : 250,
        zIndex: baseZIndex + i + 1,
        rotation: (Math.random() - 0.5) * 6,
        content: mediaId, // Store media ID instead of data URL
        metadata: {
          ...metadata,
          createdAt: now,
          updatedAt: now
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

  // Create item from AI response format
  const createItemFromAIResponse = useCallback((response: AIResponse, sourceItem: SpatialItem | null, index: number = 0): SpatialItem => {
    const baseZIndex = Math.max(...activeSpace.items.map(i => i.zIndex), 0);
    const now = Date.now();

    const baseX = sourceItem ? sourceItem.x + sourceItem.w + 100 + (index * 60) : (index * 60);
    const baseY = sourceItem ? sourceItem.y + (index * 60) : (index * 60);

    switch (response.format) {
      case 'sticky':
        return {
          id: `ai-sticky-${now}-${index}`,
          type: 'sticky',
          x: baseX,
          y: baseY,
          w: 200,
          h: 200,
          zIndex: baseZIndex + index + 1,
          rotation: (Math.random() - 0.5) * 6,
          content: response.content,
          color: response.metadata?.color || 'bg-yellow-200',
          metadata: { createdAt: now, updatedAt: now }
        };

      case 'image':
        return {
          id: `ai-image-${now}-${index}`,
          type: 'image',
          x: baseX,
          y: baseY,
          w: 300,
          h: 250,
          zIndex: baseZIndex + index + 1,
          rotation: (Math.random() - 0.5) * 4,
          content: response.content,
          metadata: { createdAt: now, updatedAt: now }
        };

      case 'note':
      case 'document':
      default:
        let content = response.content;
        const title = response.metadata?.title;

        // If title exists and content doesn't start with heading, prepend it
        if (title && !content.startsWith('<h1') && !content.startsWith('<h2')) {
          content = `<h1>${title}</h1>\n\n${content}`;
        }

        return {
          id: `ai-note-${now}-${index}`,
          type: 'note',
          x: baseX,
          y: baseY,
          w: 320,
          h: 400,
          zIndex: baseZIndex + index + 1,
          rotation: (Math.random() - 0.5) * 4,
          content,
          metadata: {
            title,
            createdAt: now,
            updatedAt: now
          }
        };
    }
  }, [activeSpace.items]);

  // Handle AI-generated content from connection handle or selection
  const handleAIGeneration = useCallback(async (
    sourceItemId: string | string[],
    prompt: string,
    options?: AIOptions,
    existingItemId?: string,
    targetNodeId?: string,
    canvasPosition?: { x: number; y: number }
  ) => {
    // Get source items (single or multiple)
    const sourceIds = Array.isArray(sourceItemId) ? sourceItemId : [sourceItemId];
    const sourceItems = activeSpace.items.filter(i => sourceIds.includes(i.id));

    // If no source items and no canvas position, bail
    if (sourceItems.length === 0 && !canvasPosition) return;

    // Use first item as primary for positioning, or center if no source
    const sourceItem = sourceItems.length > 0 ? sourceItems[0] : null;

    // If targetNodeId is set, check if it's a folder/stack
    let targetSpaceId = activeSpaceId;
    if (targetNodeId) {
      const targetNode = activeSpace.items.find(i => i.id === targetNodeId);
      if (targetNode?.type === 'folder' && targetNode.linkedSpaceId) {
        console.log('[App] Routing AI content to stack space:', targetNode.linkedSpaceId);
        targetSpaceId = targetNode.linkedSpaceId;
      }
    }

    // Use existing item or create new placeholder
    const newItemId = existingItemId || `ai-${Date.now()}`;

    // Determine initial type from options - use source dimensions for consistency
    const initialType = options?.outputType === 'image' ? 'image' : (options?.outputType || 'note');

    // Default dimensions for new items
    const defaultDimensions = { w: 320, h: 400 };

    const newItem: SpatialItem = {
      id: newItemId,
      type: initialType as 'sticky' | 'note' | 'image',
      x: sourceItem ? sourceItem.x + sourceItem.w + 100 : (canvasPosition ? canvasPosition.x - window.innerWidth/2 : 0),
      y: sourceItem ? sourceItem.y : (canvasPosition ? canvasPosition.y - window.innerHeight/2 : 0),
      w: sourceItem ? sourceItem.w : defaultDimensions.w,
      h: sourceItem ? sourceItem.h : defaultDimensions.h,
      zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
      rotation: (Math.random() - 0.5) * 4,
      content: '',
      color: initialType === 'sticky' ? 'bg-yellow-200' : undefined,
      metadata: {
        isGenerating: true,
        prompt,
        imageResolution: options?.imageResolution,
        imageStyle: options?.imageStyle
      }
    };

    // Add new item or update existing item in target space
    setSpaces(prev => {
      const existingItem = prev[targetSpaceId].items.find(i => i.id === newItemId);
      const targetSpace = prev[targetSpaceId];

      // Position in target space (center if it's a different space)
      const finalItem = targetSpaceId !== activeSpaceId
        ? { ...newItem, x: 0, y: 0 }
        : newItem;

      return {
        ...prev,
        [targetSpaceId]: {
          ...targetSpace,
          items: existingItem
            ? targetSpace.items.map(i => i.id === newItemId ? { ...i, ...finalItem } : i)
            : [...targetSpace.items, finalItem],
          connections: existingItem || targetSpaceId !== activeSpaceId || !sourceItem
            ? targetSpace.connections
            : [
                ...(targetSpace.connections || []),
                {
                  id: `conn-${Date.now()}`,
                  from: sourceItemId as string,
                  to: newItemId
                }
              ]
        }
      };
    });

    try {
      // Use AI provider with MCP tools when available
      const { generateTextStream, getLanguageModel, AIProvider } = await import('./utils/aiProvider');
      const { streamText } = await import('ai');

      // Get provider from settings
      const selectedProvider = (localStorage.getItem('ai-provider') || 'google') as AIProvider;

      // Prepare context from all source items (empty if no source items)
      const contextParts = sourceItems.length > 0 ? sourceItems.map(item => {
        const isVisual = item.type === 'image' || item.type === 'video';
        return isVisual
          ? `[${item.type}: ${item.metadata?.description as string || 'Visual content'}]`
          : item.content.replace(/<[^>]*>/g, ' ').trim();
      }) : [];
      const contextText = contextParts.join('\n\n');

      // Disable MCP tools for AI chat - they cause schema compatibility issues
      const hasTools = false;
      const toolDefs: any[] = [];

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
          // Check if item exists in target space
          const itemExists = prev[targetSpaceId].items.some(i => i.id === newItemId);
          if (!itemExists) {
            console.log('[App] AI generation item was deleted, skipping update');
            return prev;
          }

          return {
            ...prev,
            [targetSpaceId]: {
              ...prev[targetSpaceId],
              items: prev[targetSpaceId].items.map(item =>
                item.id === newItemId
                  ? { ...item, content: cleanedContent }
                  : item
              )
            }
          };
        });
      };

      // For image generation, use image model directly with AI SDK
      if (options?.outputType === 'image') {
        console.log('[App] Image mode detected, using gemini-2.5-flash-image');

        const { generateImage } = await import('./utils/imageGeneration');

        try {
          // Get source image if the selected item is an image (for image-to-image)
          const sourceImageData = sourceItem.type === 'image' ? sourceItem.content : undefined;

          const imageUrl = await generateImage(prompt, {
            resolution: options?.imageResolution,
            style: options?.imageStyle,
            provider: selectedProvider,
            sourceImage: sourceImageData
          });

          console.log('[App] Image generated, creating image item');

          // Create image item directly - use source dimensions
          const imageItem: SpatialItem = {
            id: newItemId,
            type: 'image',
            x: sourceItem.x + sourceItem.w + 100,
            y: sourceItem.y,
            w: sourceItem.w,
            h: sourceItem.h,
            zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
            rotation: (Math.random() - 0.5) * 4,
            content: imageUrl,
            metadata: {
              prompt,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          };

          setSpaces(prev => ({
            ...prev,
            [targetSpaceId]: {
              ...prev[targetSpaceId],
              items: [...prev[targetSpaceId].items.filter(i => i.id !== newItemId), imageItem]
            }
          }));

          return; // Done
        } catch (imgError) {
          console.error('[App] Image generation failed:', imgError);
          updateContent(`\n\nImage generation failed: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`);
          // Fall through to mark as complete with error
        }
      } else {
        // Text/note/sticky generation
        const fullPrompt = contextText
          ? `Context: "${contextText}"\n\nUser request: ${prompt}\n\nRespond in HTML format with proper paragraph tags.`
          : `${prompt}\n\nRespond in HTML format with proper paragraph tags.`;
        await generateTextStream(fullPrompt, updateContent, { systemPrompt: AI_FORMAT_SYSTEM_PROMPT, provider: selectedProvider });
      }

      // Only parse format tags if outputType is 'auto' - otherwise respect user's choice
      console.log('[App] Checking parseAIResponse:', { outputType: options?.outputType, willParse: options?.outputType === 'auto' });

      if (options?.outputType === 'auto') {
        const responses = parseAIResponse(fullContent);
        console.log('[App] Parsed responses:', responses.map(r => ({ format: r.format, length: r.content.length })));

        if (responses.length > 1 || responses[0].format !== 'text') {
          // Multiple items or special format - replace placeholder
          const generatedItems = responses.map((resp, idx) => createItemFromAIResponse(resp, sourceItem, idx));
          console.log('[App] Replacing placeholder with parsed items:', generatedItems.map(i => i.type));

          setSpaces(prev => ({
            ...prev,
            [targetSpaceId]: {
              ...prev[targetSpaceId],
              items: [...prev[targetSpaceId].items.filter(i => i.id !== newItemId), ...generatedItems],
              connections: targetSpaceId === activeSpaceId
                ? [
                    ...(prev[targetSpaceId].connections || []),
                    ...generatedItems.map(item => ({
                      id: `conn-${Date.now()}-${item.id}`,
                      from: sourceIds[0],
                      to: item.id
                    }))
                  ]
                : prev[targetSpaceId].connections
            }
          }));
          return;
        }
      }

      // Mark as complete
      setSpaces(prev => {
        const itemExists = prev[targetSpaceId].items.some(i => i.id === newItemId);
        if (!itemExists) {
          console.log('[App] AI generation item was deleted, skipping completion update');
          return prev;
        }

        return {
          ...prev,
          [targetSpaceId]: {
            ...prev[targetSpaceId],
            items: prev[targetSpaceId].items.map(item =>
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
        const itemExists = prev[targetSpaceId].items.some(i => i.id === newItemId);
        if (!itemExists) {
          console.log('[App] AI generation item was deleted, skipping error update');
          return prev;
        }

        return {
          ...prev,
          [targetSpaceId]: {
            ...prev[targetSpaceId],
            items: prev[targetSpaceId].items.map(item =>
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


  const handleAutoArrange = useCallback((
    layoutType: LayoutType,
    sortBy: SortOption,
    selectedIds: Set<string>,
    flowDirection: FlowDirection = 'horizontal',
    itemSpacing: ItemSpacing = 'comfortable'
  ) => {
    if (activeSpace.items.length === 0) return;

    const layout = getLayoutFunction(layoutType);

    const itemsToArrange = selectedIds.size > 0
      ? activeSpace.items.filter(item => selectedIds.has(item.id))
      : activeSpace.items;

    const otherItems = selectedIds.size > 0
      ? activeSpace.items.filter(item => !selectedIds.has(item.id))
      : [];

    const arranged = layout(itemsToArrange, { sortBy, flowDirection, itemSpacing });
    const newItems = [...arranged, ...otherItems];

    updateItems(newItems);

    setSpaces(prev => ({
      ...prev,
      [activeSpaceId]: {
        ...prev[activeSpaceId],
        layoutType,
        sortBy,
        flowDirection,
        itemSpacing
      }
    }));

    const fitParams = getFitToViewParams(arranged);
    setCameraOverride({ ...fitParams, id: Date.now().toString() });
  }, [activeSpace.items, activeSpaceId, updateItems]);

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
      } else if (e.key === 'k' && e.metaKey) {
          // Open search with Cmd+K
          e.preventDefault();
          setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSpace, mediaViewerItem, noteViewerItem, selection, handleDeleteItems, showAIModal, topLevelSpaces, activeSpaceId]);

  // Theme color mapping
  const themeColors: Record<string, { bg: string; tint: string }> = {
    light: { bg: '#f8f7f4', tint: '#ffffff' },
    warm: { bg: '#fff7ed', tint: '#fed7aa' },
    ocean: { bg: '#eff6ff', tint: '#bfdbfe' },
    forest: { bg: '#f0fdf4', tint: '#bbf7d0' },
    sunset: { bg: '#fdf2f8', tint: '#fbcfe8' },
    dark: { bg: '#1f2937', tint: '#374151' },
  };

  const currentTheme = themeColors[theme] || themeColors.light;

  // Shader selection
  const [selectedShader, setSelectedShader] = useState(localStorage.getItem('background-shader') || 'neuro-noise');
  const [shaderPerformance, setShaderPerformance] = useState(localStorage.getItem('shader-performance') || 'balanced');
  
  const [shaderPaused, setShaderPaused] = useState(false);
  
  useEffect(() => {
    if (shaderPerformance === 'quality') return;
    
    const handleVisibilityChange = () => {
      if (shaderPerformance === 'battery') {
        setShaderPaused(document.hidden);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [shaderPerformance]);

  const renderShader = () => {
    if (shaderPaused) return null;
    
    const scale = shaderPerformance === 'battery' ? 0.5 : shaderPerformance === 'balanced' ? 0.75 : 1;
    const shaderStyle = { 
      width: `${100 / scale}%`, 
      height: `${100 / scale}%`,
      transform: `scale(${scale})`,
      transformOrigin: 'top left'
    };

    switch (selectedShader) {
      case 'none':
        return null;
      case 'paper-texture':
        return <PaperTexture grainScale={2.0} scaleX={1.0} scaleY={1.0} style={shaderStyle} />;
      case 'mesh-gradient':
        return <MeshGradient style={shaderStyle} />;
      case 'grain-gradient':
        return <GrainGradient style={shaderStyle} />;
      case 'dithering':
        return <Dithering style={shaderStyle} />;
      case 'dot-grid':
        return <DotGrid style={shaderStyle} />;
      case 'simplex-noise':
        return <SimplexNoise style={shaderStyle} />;
      case 'perlin-noise':
        return <PerlinNoise style={shaderStyle} />;
      case 'waves':
        return <Waves style={shaderStyle} />;
      case 'water':
        return <Water style={shaderStyle} />;
      case 'smoke-ring':
        return <SmokeRing style={shaderStyle} />;
      case 'neuro-noise':
        return <NeuroNoise style={shaderStyle} />;
      case 'dot-orbit':
        return <DotOrbit style={shaderStyle} />;
      case 'metaballs':
        return <Metaballs style={shaderStyle} />;
      case 'voronoi':
        return <Voronoi style={shaderStyle} />;
      case 'liquid-metal':
        return <LiquidMetal style={shaderStyle} />;
      case 'fluted-glass':
        return <FlutedGlass style={shaderStyle} />;
      case 'god-rays':
        return <GodRays style={shaderStyle} />;
      case 'spiral':
        return <Spiral style={shaderStyle} />;
      case 'swirl':
        return <Swirl style={shaderStyle} />;
      case 'warp':
        return <Warp style={shaderStyle} />;
      case 'color-panels':
        return <ColorPanels style={shaderStyle} />;
      case 'static-mesh-gradient':
        return <StaticMeshGradient style={shaderStyle} />;
      case 'static-radial-gradient':
        return <StaticRadialGradient style={shaderStyle} />;
      case 'pulsing-border':
        return <PulsingBorder style={shaderStyle} />;
      case 'halftone-dots':
        return <HalftoneDots style={shaderStyle} />;
      case 'heatmap':
        return <Heatmap style={shaderStyle} />;
      default:
        return <PaperTexture grainScale={2.0} scaleX={1.0} scaleY={1.0} style={shaderStyle} />;
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden text-gray-900" style={{ backgroundColor: currentTheme.bg }}>
      {/* Shader Background */}
      {selectedShader !== 'none' && (
        <div className="absolute inset-0 z-0 opacity-40" style={{ width: '100%', height: '100%' }}>
          {renderShader()}
        </div>
      )}

      {/* Theme Tint Overlay */}
      <div
        className="absolute inset-0 z-0 mix-blend-overlay opacity-30 pointer-events-none"
        style={{ backgroundColor: currentTheme.tint }}
      />

      {/* Persistent Navigation (Top Left) - Hidden in overview */}
      {!showOverview && (
        <div className="absolute left-4 z-50 flex items-center gap-2" style={{ top: 21 }}>
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

          {/* Search Button */}
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 bg-white/40 backdrop-blur-md rounded-full shadow-lg hover:bg-white/50 transition-colors border border-white/60"
            title="Search (⌘K)"
          >
            <Search size={20} className="text-gray-800" />
          </button>
        </div>
      )}

      {/* Auto Arrange Button - Top Center */}
      {!showOverview && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50" style={{ top: 21 }}>
          <AutoArrangeButton
            layoutType={activeSpace.layoutType || 'grid'}
            sortBy={activeSpace.sortBy || 'updated'}
            flowDirection={activeSpace.flowDirection || 'horizontal'}
            itemSpacing={activeSpace.itemSpacing || 'comfortable'}
            onLayoutChange={(layout) => {
              if (layout !== 'free') {
                handleAutoArrange(
                  layout,
                  activeSpace.sortBy || 'updated',
                  new Set(),
                  activeSpace.flowDirection || 'horizontal',
                  activeSpace.itemSpacing || 'comfortable'
                );
              } else {
                setSpaces(prev => ({ ...prev, [activeSpaceId]: { ...prev[activeSpaceId], layoutType: layout } }));
              }
            }}
            onSortChange={(sort) => {
              const layout = activeSpace.layoutType || 'grid';
              if (layout !== 'free') {
                handleAutoArrange(layout, sort, new Set(), activeSpace.flowDirection || 'horizontal', activeSpace.itemSpacing || 'comfortable');
              } else {
                setSpaces(prev => ({ ...prev, [activeSpaceId]: { ...prev[activeSpaceId], sortBy: sort } }));
              }
            }}
            onFlowChange={(flow) => {
              const layout = activeSpace.layoutType || 'grid';
              if (layout !== 'free') {
                handleAutoArrange(layout, activeSpace.sortBy || 'updated', new Set(), flow, activeSpace.itemSpacing || 'comfortable');
              }
            }}
            onSpacingChange={(spacing) => {
              const layout = activeSpace.layoutType || 'grid';
              if (layout !== 'free') {
                handleAutoArrange(layout, activeSpace.sortBy || 'updated', new Set(), activeSpace.flowDirection || 'horizontal', spacing);
              }
            }}
            onArrange={() => handleAutoArrange(
              activeSpace.layoutType || 'grid',
              activeSpace.sortBy || 'updated',
              new Set(),
              activeSpace.flowDirection || 'horizontal',
              activeSpace.itemSpacing || 'comfortable'
            )}
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
          onDeleteSpace={(spaceId) => {
            setSpaces(prev => {
              const { [spaceId]: deleted, ...remaining } = prev;
              return remaining;
            });
            // If deleting active space, switch to first remaining top-level space
            if (spaceId === activeSpaceId) {
              const remainingTopLevel = topLevelSpaces.filter(s => s.id !== spaceId);
              if (remainingTopLevel.length > 0) {
                setActiveSpaceId(remainingTopLevel[0].id);
              }
            }
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
              layoutType={activeSpace.layoutType || 'grid'}
              selection={selection}
              onSelectionChange={setSelection}
              onUpdateItems={updateItems}
              onNavigate={handleNavigate}
              highlightedNodeId={highlightedNodeId}
              onNodeClick={aiPromptState?.targetNodeId ? (itemId) => {
                // Change AI prompt target to clicked node
                console.log('[App] Changing AI target to:', itemId);
                setHighlightedNodeId(itemId);
                setAIPromptState({ ...aiPromptState, targetNodeId: itemId });
              } : undefined}
              onBlankCanvasClick={aiPromptState ? () => {
                // Clear AI prompt when clicking blank canvas
                console.log('[App] Blank canvas click, clearing AI prompt');
                setAIPromptState(null);
                setHighlightedNodeId(null);
              } : undefined}
              onBlankCanvasDoubleClick={(position) => {
                // Open AI chat on empty canvas double-click
                setAIPromptState({
                  itemIds: new Set(),
                  position,
                  mode: 'selection'
                });
              }}
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
                // CRITICAL: Use functional update to avoid stale closure overwriting drag positions
                updateItems(currentItems =>
                  currentItems.map(item =>
                    ids.includes(item.id)
                      ? { ...item, metadata: { ...item.metadata, manuallyPositioned: true } }
                      : item
                  )
                );
              }}
              onAIPromptStart={(itemId, position) => {
                // Always start with normal flow - no smart routing
                // Smart routing is disabled until we can fix the UX issues
                setHighlightedNodeId(null);
                setAIPromptState({ itemId, position, mode: 'single' });
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
              contextTip={contextTip}
              contentZoom={contentZoom}
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
          onArrangeSelection={(layoutType, sortBy) => {
            // Arrange only selected items
            handleAutoArrange(layoutType, sortBy, selection);
          }}
          onAIChat={(ids, position) => {
            setAIPromptState({ itemIds: ids, position, mode: 'selection' });
          }}
          onRegenerate={(ids) => {
            // Re-run the original prompt for selected items
            ids.forEach(id => {
              const item = activeSpace.items.find(i => i.id === id);
              if (item?.metadata?.prompt) {
                console.log('[App] Regenerating item:', id, 'with prompt:', item.metadata.prompt);

                // Find the original source item (from connections)
                const sourceConn = activeSpace.connections?.find(c => c.to === id);
                const sourceId = sourceConn?.from || id;

                // Re-run with stored options or defaults, passing existingItemId to update instead of create
                handleAIGeneration(sourceId, item.metadata.prompt, {
                  outputType: item.type === 'image' ? 'image' : item.type === 'sticky' ? 'sticky' : 'note',
                  imageResolution: item.metadata.imageResolution as any,
                  imageStyle: item.metadata.imageStyle as any
                }, id);
              }
            });
          }}
          layoutType={activeSpace.layoutType || 'grid'}
          sortBy={activeSpace.sortBy || 'updated'}
        />
      )}

      {/* Space Navigation + Actions - Bottom Right */}
      {!showOverview && (
        <div className="absolute right-8 flex items-center gap-3 z-50" style={{ bottom: 18 }}>
          {/* Space Indicator - Always visible */}
          <div className="bg-white/40 backdrop-blur-md rounded-full px-1.5 py-1 shadow-lg border border-white/60">
            <div className="flex items-center gap-1.5">
              {/* Previous button (hidden if single space) */}
              {topLevelSpaces.length > 1 && (
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
                  className={`p-1.5 rounded-full transition-all ${
                    topLevelSpaces.findIndex(s => s.id === activeSpaceId) === 0
                      ? 'opacity-0 cursor-not-allowed'
                      : 'hover:bg-gray-800/10 text-gray-800 shadow-lg'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              )}

              {/* Space dots (only if multiple spaces) */}
              {topLevelSpaces.length > 1 && (
                <div className="flex items-center gap-1 px-1.5">
                  {topLevelSpaces.map((space) => (
                    <button
                      key={space.id}
                      onClick={() => {
                        setActiveSpaceId(space.id);
                        setSelection(new Set());
                      }}
                      className={`transition-all duration-300 rounded-full ${
                        space.id === activeSpaceId
                          ? 'w-5 h-1 bg-gray-800'
                          : 'w-1 h-1 bg-gray-600/50 hover:bg-gray-700/70'
                      }`}
                      title={space.name}
                    />
                  ))}
                </div>
              )}

              {/* Next button OR Add Space button */}
              {(() => {
                const currentIndex = topLevelSpaces.findIndex(s => s.id === activeSpaceId);
                const isLastSpace = topLevelSpaces.length > 1 && currentIndex === topLevelSpaces.length - 1;
                const canPageForward = topLevelSpaces.length > 1 && currentIndex < topLevelSpaces.length - 1;

                if (isLastSpace || topLevelSpaces.length === 1) {
                  // Show + button when at last space or single space
                  return (
                    <button
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
                      className="p-1.5 rounded-full hover:bg-gray-800/10 text-gray-800 transition-all shadow-lg"
                      title="New Space"
                    >
                      <SquarePlus size={16} />
                    </button>
                  );
                }

                // Show > arrow if can page forward
                return (
                  <button
                    onClick={() => {
                      const nextSpace = topLevelSpaces[currentIndex + 1];
                      setActiveSpaceId(nextSpace.id);
                      setSelection(new Set());
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-800/10 text-gray-800 transition-all shadow-lg"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Add Button with Menu */}
          <div className="relative">
            {/* Add Menu Dropdown */}
            {showAddMenu && (
              <div className="absolute bottom-16 right-0 bg-white/40 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-2 flex flex-col gap-1 min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                    setQuickGenerateMode('image');
                    setShowAddMenu(false);
                  }}
                >
                  <ImageIcon size={18} />
                  <span className="text-sm">AI Image</span>
                </button>
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    setQuickGenerateMode('video');
                    setShowAddMenu(false);
                  }}
                >
                  <Video size={18} />
                  <span className="text-sm">AI Video</span>
                </button>
                <button
                  className="p-3 rounded-xl bg-gray-800/5 hover:bg-gray-800/10 text-gray-800 transition-all active:scale-95 flex items-center gap-2"
                  onClick={() => {
                    setQuickGenerateMode('audio');
                    setShowAddMenu(false);
                  }}
                >
                  <Mic size={18} />
                  <span className="text-sm">Transcribe</span>
                </button>
                <div className="border-t border-gray-200/50 my-1" />
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
                  <Layers size={18} />
                  <span className="text-sm">Stack</span>
                </button>
              </div>
            )}

            {/* Quick Generate Dialog */}
            {quickGenerateMode && (
              <QuickGenerate
                initialMode={quickGenerateMode}
                onClose={() => setQuickGenerateMode(null)}
                onGenerate={(type, content, metadata) => {
                  const now = Date.now();
                  const newItem: SpatialItem = {
                    id: now.toString(),
                    type,
                    x: -window.innerWidth/2 * 0.1 + (Math.random() * 40 - 20),
                    y: 0 + (Math.random() * 40 - 20),
                    w: type === 'video' ? 400 : 300,
                    h: type === 'video' ? 280 : type === 'image' ? 300 : 200,
                    zIndex: Math.max(...activeSpace.items.map(i => i.zIndex), 0) + 1,
                    rotation: (Math.random() - 0.5) * 4,
                    content: content,
                    metadata: { ...metadata, createdAt: now, updatedAt: now }
                  };
                  updateItems([...activeSpace.items, newItem]);
                }}
              />
            )}

            <button
              className={`bg-white/40 backdrop-blur-md border border-white/60 text-gray-800 p-2.5 rounded-full hover:bg-white/50 transition-all shadow-lg hover:scale-105 active:scale-95 ${showAddMenu || quickGenerateMode ? 'rotate-45' : ''}`}
              onClick={() => {
                if (quickGenerateMode) {
                  setQuickGenerateMode(null);
                } else {
                  setShowAddMenu(!showAddMenu);
                }
              }}
            >
              {showAddMenu || quickGenerateMode ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close add menu or quick generate */}
      {(showAddMenu || quickGenerateMode) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowAddMenu(false);
            setQuickGenerateMode(null);
          }}
        />
      )}

      {/* Settings Button - Top Right */}
      {!showOverview && (
        <button
          className="absolute right-4 p-2 bg-white/40 backdrop-blur-md rounded-full shadow-lg hover:bg-white/50 transition-colors border border-white/60 z-50"
          style={{ top: 21 }}
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <Settings size={20} className="text-gray-800" />
        </button>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onThemeChange={(newTheme) => setTheme(newTheme)}
          onShaderChange={(shader) => setSelectedShader(shader)}
          onShaderPerformanceChange={(perf) => setShaderPerformance(perf)}
        />
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        spaces={Object.values(spaces)}
        onSelectItem={(item, spaceId) => {
          // Navigate to the space containing the item
          setActiveSpaceId(spaceId);
          setShowSearch(false);
          // Select the item after a brief delay to allow navigation
          setTimeout(() => {
            setSelection(new Set([item.id]));
            // Scroll/pan to the item
            setViewport(prev => ({
              ...prev,
              x: -item.x + window.innerWidth / 2 - (item.w || 200) / 2,
              y: -item.y + window.innerHeight / 2 - (item.h || 200) / 2
            }));
          }, 100);
        }}
      />

      {/* AI Chat Popup (from connection handles or selection) */}
      {aiPromptState && (() => {
        // Handle both single item and selection modes
        if (aiPromptState.mode === 'selection' && aiPromptState.itemIds) {
          const selectedItems = activeSpace.items.filter(i => aiPromptState.itemIds!.has(i.id));
          const previewText = selectedItems.length === 1
            ? (selectedItems[0].type === 'image' || selectedItems[0].type === 'video'
                ? `${selectedItems[0].type}: ${selectedItems[0].metadata?.description || 'visual content'}`
                : selectedItems[0].content.replace(/<[^>]*>/g, '').slice(0, 30) + '...')
            : `${selectedItems.length} selected items`;

          return (
            <AIChat
              position={aiPromptState.position}
              placeholder={`Ask AI about: ${previewText}...`}
              initialExpanded={false}
              onSubmit={(prompt, options) => {
                // If all selected items are images and output type is auto, default to image mode
                const allImages = selectedItems.every(i => i.type === 'image');
                if (allImages && options?.outputType === 'auto') {
                  console.log('[App] All selected items are images, forcing image mode');
                  options = { ...options, outputType: 'image' };
                }
                handleAIGeneration(
                  Array.from(aiPromptState.itemIds!),
                  prompt,
                  options,
                  undefined,
                  undefined,
                  aiPromptState.itemIds.size === 0 ? aiPromptState.position : undefined
                );
                setAIPromptState(null);
              }}
              onClose={() => setAIPromptState(null)}
            />
          );
        }

        // Single item mode
        const sourceItem = activeSpace.items.find(i => i.id === aiPromptState.itemId);
        const sourcePreview = sourceItem
          ? (sourceItem.type === 'image' || sourceItem.type === 'video'
              ? `${sourceItem.type}: ${sourceItem.metadata?.description || 'visual content'}`
              : sourceItem.content.replace(/<[^>]*>/g, '').slice(0, 50) + (sourceItem.content.length > 50 ? '...' : ''))
          : '';

        // Get target node label if routing to existing connection
        const targetNode = aiPromptState.targetNodeId
          ? activeSpace.items.find(i => i.id === aiPromptState.targetNodeId)
          : undefined;
        const targetLabel = targetNode
          ? (targetNode.type === 'folder'
              ? `Stack: ${targetNode.metadata?.name || 'Untitled'}`
              : `${targetNode.type}: ${targetNode.content.replace(/<[^>]*>/g, '').slice(0, 30)}...`)
          : undefined;

        return (
          <AIChat
            position={aiPromptState.position}
            placeholder={`Ask AI about: ${sourcePreview || 'this item'}...`}
            initialExpanded={false}
            targetNodeLabel={targetLabel}
            disableBackdropClose={!!aiPromptState.targetNodeId}
            onTargetNodeClick={() => {
              // Clear target, revert to normal mode
              setHighlightedNodeId(null);
              setAIPromptState({ ...aiPromptState, targetNodeId: undefined });
            }}
            onSubmit={(prompt, options) => {
              if (aiPromptState.itemId) {
                // If source is an image and output type is auto, default to image mode
                if (sourceItem?.type === 'image' && options?.outputType === 'auto') {
                  console.log('[App] Source is image, forcing image mode');
                  options = { ...options, outputType: 'image' };
                }
                handleAIGeneration(
                  aiPromptState.itemId,
                  prompt,
                  options,
                  undefined,
                  aiPromptState.targetNodeId
                );
              }
              setAIPromptState(null);
              setHighlightedNodeId(null);
            }}
            onClose={() => {
              setAIPromptState(null);
              setHighlightedNodeId(null);
            }}
          />
        );
      })()}

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
            onCloseWithVariants={(originalItem, variants) => {
              // Close viewer first
              setMediaViewerItem(null);
              setMediaViewerRect(null);

              // Create a stack from the variants
              if (variants.length > 1) {
                const now = Date.now();
                const newSpaceId = `variants-${now}`;

                // Create items for each variant
                const variantItems: SpatialItem[] = variants.map((variant, index) => ({
                  id: `variant-${now}-${index}`,
                  type: originalItem.type,
                  x: (index % 3) * 40 - 40,
                  y: Math.floor(index / 3) * 40 - 40,
                  w: originalItem.w,
                  h: originalItem.h,
                  zIndex: index + 1,
                  rotation: (Math.random() - 0.5) * 4,
                  content: variant.isOriginal ? originalItem.content : variant.url,
                  metadata: {
                    ...originalItem.metadata,
                    prompt: variant.prompt,
                    isVariant: !variant.isOriginal,
                    originalId: variant.isOriginal ? undefined : originalItem.id,
                    createdAt: now,
                    updatedAt: now
                  }
                }));

                // Create folder to replace original
                const folderItem: SpatialItem = {
                  id: `folder-${now}`,
                  type: 'folder',
                  x: originalItem.x,
                  y: originalItem.y,
                  w: 200,
                  h: 240,
                  zIndex: originalItem.zIndex,
                  rotation: 0,
                  content: `Variants (${variants.length})`,
                  linkedSpaceId: newSpaceId
                };

                setSpaces(prev => {
                  const space = prev[activeSpaceId];

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
                      name: `Variants (${variants.length})`,
                      parentId: activeSpaceId,
                      items: variantItems,
                      connections: [],
                      camera: { x: 0, y: 0, zoom: 1 }
                    }
                  };
                });
              }
            }}
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