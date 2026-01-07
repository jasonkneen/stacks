import { useState, useCallback, useEffect, useMemo } from 'react';
import { Space, SpatialItem } from '../types';
import { loadSpaces, saveSpaces } from '../utils/storage';
import { analyzeImage } from '../utils/imageAnalysis';
import { isMediaId, getMediaURL } from '../lib/mediaStorage';

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

export function useSpaces() {
  const [spaces, setSpacesRaw] = useState<Record<string, Space>>(INITIAL_SPACES);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(ROOT_SPACE_ID);

  const setSpaces = useCallback((update: Record<string, Space> | ((prev: Record<string, Space>) => Record<string, Space>)) => {
    setSpacesRaw(prev => {
      const newState = typeof update === 'function' ? update(prev) : update;
      return newState;
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const testKey = 'scratchpad-test';
        try {
          localStorage.setItem(testKey, 'test');
          localStorage.removeItem(testKey);
        } catch {
          localStorage.clear();
        }

        const saved = await loadSpaces();
        if (saved) {
          const fixed = Object.fromEntries(
            Object.entries(saved).map(([id, space]) => [
              id,
              {
                ...space,
                items: space.items.map(item => {
                  const noteMatch = item.content?.match(/\[NOTE:([^\]]+)\]([\s\S]*?)\[\/NOTE\]/);
                  if (noteMatch) {
                    const title = noteMatch[1];
                    let content = noteMatch[2].trim();
                    if (!content.startsWith('<h1') && !content.startsWith('<h2')) {
                      content = `<h1>${title}</h1>\n\n${content}`;
                    }
                    return {
                      ...item,
                      type: 'note' as const,
                      content,
                      metadata: { ...item.metadata, title }
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
        console.error('[useSpaces] Failed to load:', error);
      } finally {
        setIsLoadingSpaces(false);
      }
    };
    init();
  }, [setSpaces]);

  const activeSpace = spaces?.[activeSpaceId] || INITIAL_SPACES[ROOT_SPACE_ID];

  const topLevelSpaces = useMemo(() => {
    if (!spaces) return [INITIAL_SPACES[ROOT_SPACE_ID]];
    return Object.values(spaces).filter(s => s?.parentId === null);
  }, [spaces]);

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
  }, [activeSpaceId, setSpaces]);

  const handleDeleteItems = useCallback((ids: Set<string>) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const newItems = space.items.filter(i => !ids.has(i.id));
      const newConnections = (space.connections || []).filter(c => !ids.has(c.from) && !ids.has(c.to));

      const newSpaces = {
        ...prev,
        [activeSpaceId]: {
          ...space,
          items: newItems,
          connections: newConnections
        }
      };

      saveSpaces(newSpaces).catch(err => console.error('[useSpaces] Delete save failed:', err));
      return newSpaces;
    });
  }, [activeSpaceId, setSpaces]);

  const handleUngroup = useCallback((folderId: string) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const folder = space.items.find(i => i.id === folderId);

      if (!folder || folder.type !== 'folder' || !folder.linkedSpaceId) return prev;

      const linkedSpace = prev[folder.linkedSpaceId];
      if (!linkedSpace) return prev;

      const unpackedItems = linkedSpace.items.map((item, index) => ({
        ...item,
        x: folder.x + (index % 3) * 40 - 40,
        y: folder.y + Math.floor(index / 3) * 40 - 40,
        zIndex: Math.max(...space.items.map(i => i.zIndex), 0) + index + 1
      }));

      const newItems = [
        ...space.items.filter(i => i.id !== folderId),
        ...unpackedItems
      ];

      const firstUnpackedId = unpackedItems[0]?.id;
      const newConnections = (space.connections || []).map(conn => ({
        ...conn,
        from: conn.from === folderId && firstUnpackedId ? firstUnpackedId : conn.from,
        to: conn.to === folderId && firstUnpackedId ? firstUnpackedId : conn.to
      }));

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
  }, [activeSpaceId, setSpaces]);

  const handleGroupToStack = useCallback((ids: Set<string>) => {
    setSpaces(prev => {
      const space = prev[activeSpaceId];
      const selectedItems = space.items.filter(i => ids.has(i.id));
      const remainingItems = space.items.filter(i => !ids.has(i.id));

      if (selectedItems.length < 2) return prev;

      const centerX = selectedItems.reduce((sum, i) => sum + i.x + i.w / 2, 0) / selectedItems.length;
      const centerY = selectedItems.reduce((sum, i) => sum + i.y + i.h / 2, 0) / selectedItems.length;

      const newSpaceId = `stack-${Date.now()}`;

      const stackedItems = selectedItems.map(item => ({
        ...item,
        x: item.x - centerX + item.w / 2,
        y: item.y - centerY + item.h / 2,
      }));

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

      const updatedConnections = (space.connections || []).map(conn => {
        let newConn = { ...conn };
        if (ids.has(conn.from)) newConn.from = folderId;
        if (ids.has(conn.to)) newConn.to = folderId;
        return newConn;
      }).filter(conn => conn.from !== conn.to);

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
  }, [activeSpaceId, setSpaces]);

  const getSpaceItems = useCallback((spaceId: string) => {
    return spaces[spaceId]?.items || [];
  }, [spaces]);

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

    let resolvedUrl = imageUrl;
    if (isMediaId(imageUrl)) {
      const objectUrl = await getMediaURL(imageUrl);
      if (!objectUrl) {
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

    let analysis;
    try {
      analysis = await analyzeImage(resolvedUrl);
    } catch {
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

    setSpaces(prev => {
      const itemExists = prev[targetSpaceId]?.items.some(i => i.id === itemId);
      if (!itemExists) return prev;

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
  }, [activeSpaceId, setSpaces]);

  const handleNavigate = useCallback((targetSpaceId: string) => {
    if (spaces[targetSpaceId]) {
      setActiveSpaceId(targetSpaceId);
    }
  }, [spaces]);

  const handleBack = useCallback(() => {
    if (activeSpace.parentId) {
      setActiveSpaceId(activeSpace.parentId);
    }
  }, [activeSpace.parentId]);

  return {
    spaces,
    setSpaces,
    isLoadingSpaces,
    activeSpaceId,
    setActiveSpaceId,
    activeSpace,
    topLevelSpaces,
    updateItems,
    handleDeleteItems,
    handleUngroup,
    handleGroupToStack,
    getSpaceItems,
    analyzeAndUpdateImage,
    handleNavigate,
    handleBack,
    ROOT_SPACE_ID,
    INITIAL_SPACES
  };
}
