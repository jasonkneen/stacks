import { Space, SpatialItem } from '../types';

const STORAGE_KEY = 'scratchpad-data';
const MEDIA_KEY_PREFIX = 'scratchpad-media-';

// Save media to localStorage and return a pointer
export const saveMedia = async (itemId: string, dataUrl: string, filename: string): Promise<string> => {
  const mediaKey = `${MEDIA_KEY_PREFIX}${itemId}`;

  try {
    localStorage.setItem(mediaKey, dataUrl);
    return mediaKey; // Return pointer instead of full data URL
  } catch (e) {
    console.error('Failed to save media:', e);
    return dataUrl; // Fallback to inline data
  }
};

// Load media from pointer
export const loadMedia = (pointer: string): string | null => {
  if (pointer.startsWith(MEDIA_KEY_PREFIX)) {
    return localStorage.getItem(pointer);
  }
  return pointer; // Already a data URL or external URL
};

// Save all spaces to localStorage (excluding large image/video data)
export const saveSpaces = async (spaces: Record<string, Space>) => {
  try {
    const { saveMediaToIndexedDB } = await import('./indexedDB');

    // Save media to IndexedDB, keep only references in localStorage
    const spacesToSave = await Promise.all(
      Object.entries(spaces).map(async ([id, space]) => {
        const items = await Promise.all(
          space.items.map(async (item) => {
            // For images/videos with data URLs, save to IndexedDB
            if ((item.type === 'image' || item.type === 'video') && item.content.startsWith('data:')) {
              await saveMediaToIndexedDB(item.id, item.content);
              return {
                ...item,
                content: `indexeddb:${item.id}` // Reference to IndexedDB
              };
            }
            return item;
          })
        );

        return [id, { ...space, items }];
      })
    );

    const spacesObj = Object.fromEntries(spacesToSave);

    const totalItems = Object.values(spaces).reduce((sum, space) => sum + space.items.length, 0);
    console.log('[storage] Saving spaces (media in IndexedDB):', {
      spaceCount: Object.keys(spaces).length,
      totalItems,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spacesObj));
  } catch (e) {
    console.error('Failed to save spaces:', e);
  }
};

// Load all spaces from localStorage
export const loadSpaces = async (): Promise<Record<string, Space> | null> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const spaces = data ? JSON.parse(data) : null;

    if (!spaces) {
      console.log('[storage] No saved spaces found, will use INITIAL_SPACES');
      return null;
    }

    // Load media from IndexedDB
    const { loadMediaFromIndexedDB } = await import('./indexedDB');

    const spacesWithMedia = await Promise.all(
      Object.entries(spaces).map(async ([id, space]) => {
        const items = await Promise.all(
          (space as Space).items.map(async (item) => {
            // Load media from IndexedDB if reference exists
            if (item.content?.startsWith('indexeddb:')) {
              const itemId = item.content.replace('indexeddb:', '');
              const dataUrl = await loadMediaFromIndexedDB(itemId);
              return {
                ...item,
                content: dataUrl || '' // Use data URL or empty if not found
              };
            }
            return item;
          })
        );

        return [id, { ...space, items }];
      })
    );

    const loadedSpaces = Object.fromEntries(spacesWithMedia);

    const totalItems = Object.values(loadedSpaces).reduce((sum, space) => sum + (space as Space).items.length, 0);
    console.log('[storage] Loading spaces (with IndexedDB media):', {
      spaceCount: Object.keys(loadedSpaces).length,
      spaceIds: Object.keys(loadedSpaces),
      totalItems,
      timestamp: new Date().toISOString()
    });

    return loadedSpaces;
  } catch (e) {
    console.error('Failed to load spaces:', e);
    return null;
  }
};

// Clear all data
export const clearAllData = () => {
  // Remove all media
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(MEDIA_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
  // Remove spaces
  localStorage.removeItem(STORAGE_KEY);
};
