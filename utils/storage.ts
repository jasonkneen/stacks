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
export const saveSpaces = (spaces: Record<string, Space>) => {
  try {
    // Strip out image/video content (data URLs) to save space
    const spacesToSave = Object.fromEntries(
      Object.entries(spaces).map(([id, space]) => [
        id,
        {
          ...space,
          items: space.items.map(item => {
            // For images/videos, don't save the content (data URL)
            if (item.type === 'image' || item.type === 'video') {
              return {
                ...item,
                content: '' // Clear data URL
              };
            }
            return item;
          })
        }
      ])
    );

    const totalItems = Object.values(spaces).reduce((sum, space) => sum + space.items.length, 0);
    console.log('[storage] Saving spaces (images excluded):', {
      spaceCount: Object.keys(spaces).length,
      totalItems,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spacesToSave));
  } catch (e) {
    console.error('Failed to save spaces:', e);
  }
};

// Load all spaces from localStorage
export const loadSpaces = (): Record<string, Space> | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const spaces = data ? JSON.parse(data) : null;
    if (spaces) {
      const totalItems = Object.values(spaces).reduce((sum, space) => sum + (space as Space).items.length, 0);
      console.log('[storage] Loading spaces:', {
        spaceCount: Object.keys(spaces).length,
        spaceIds: Object.keys(spaces),
        totalItems,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('[storage] No saved spaces found, will use INITIAL_SPACES');
    }
    return spaces;
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
