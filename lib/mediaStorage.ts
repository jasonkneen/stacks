/**
 * Media Storage System using IndexedDB
 * - Stores images and videos as Blobs
 * - Fast retrieval with object URLs
 * - Works in browser and Electron
 * - No size limits (browser-managed quota)
 */

const DB_NAME = 'stacks-media-db';
const DB_VERSION = 1;
const STORE_NAME = 'media';

interface MediaRecord {
  id: string;
  blob: Blob;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

let dbInstance: IDBDatabase | null = null;
const objectURLCache = new Map<string, string>();

/**
 * Initialize the database
 */
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB'));

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

/**
 * Generate a unique ID for media
 */
const generateId = (): string => {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Store media from a File object
 */
export const storeFile = async (
  file: File,
  metadata?: Record<string, unknown>
): Promise<string> => {
  const db = await openDB();
  const id = generateId();
  const type = file.type.startsWith('video/') ? 'video' : 'image';

  const record: MediaRecord = {
    id,
    blob: file,
    type,
    mimeType: file.type,
    size: file.size,
    createdAt: Date.now(),
    metadata,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(new Error('Failed to store media'));
  });
};

/**
 * Store media from a data URL (base64)
 */
export const storeDataURL = async (
  dataURL: string,
  metadata?: Record<string, unknown>
): Promise<string> => {
  const response = await fetch(dataURL);
  const blob = await response.blob();
  const type = blob.type.startsWith('video/') ? 'video' : 'image';

  const db = await openDB();
  const id = generateId();

  const record: MediaRecord = {
    id,
    blob,
    type,
    mimeType: blob.type,
    size: blob.size,
    createdAt: Date.now(),
    metadata,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(new Error('Failed to store media'));
  });
};

/**
 * Store media from a URL (fetches and stores locally)
 */
export const storeFromURL = async (
  url: string,
  metadata?: Record<string, unknown>
): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const type = blob.type.startsWith('video/') ? 'video' : 'image';

  const db = await openDB();
  const id = generateId();

  const record: MediaRecord = {
    id,
    blob,
    type,
    mimeType: blob.type,
    size: blob.size,
    createdAt: Date.now(),
    metadata,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(new Error('Failed to store media'));
  });
};

/**
 * Get a media blob by ID
 */
export const getMedia = async (id: string): Promise<MediaRecord | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get media'));
  });
};

/**
 * Get an object URL for a media item (cached for performance)
 */
export const getMediaURL = async (id: string): Promise<string | null> => {
  // Check cache first
  if (objectURLCache.has(id)) {
    return objectURLCache.get(id)!;
  }

  const record = await getMedia(id);
  if (!record) return null;

  const url = URL.createObjectURL(record.blob);
  objectURLCache.set(id, url);
  return url;
};

/**
 * Check if a string is a media storage ID
 */
export const isMediaId = (str: string): boolean => {
  return str.startsWith('media_');
};

/**
 * Get metadata for a media item
 */
export const getMediaMetadata = async (id: string): Promise<Record<string, unknown> | null> => {
  const record = await getMedia(id);
  if (!record) return null;

  return {
    id: record.id,
    type: record.type,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
    ...record.metadata
  };
};

/**
 * Resolve a content string to a URL (handles both regular URLs and media IDs)
 */
export const resolveMediaURL = async (content: string): Promise<string> => {
  if (isMediaId(content)) {
    const url = await getMediaURL(content);
    return url || content;
  }
  return content;
};

/**
 * Delete a media item
 */
export const deleteMedia = async (id: string): Promise<void> => {
  const db = await openDB();

  // Revoke cached object URL
  if (objectURLCache.has(id)) {
    URL.revokeObjectURL(objectURLCache.get(id)!);
    objectURLCache.delete(id);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete media'));
  });
};

/**
 * List all media items
 */
export const listMedia = async (type?: 'image' | 'video'): Promise<MediaRecord[]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let request: IDBRequest;
    if (type) {
      const index = store.index('type');
      request = index.getAll(type);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to list media'));
  });
};

/**
 * Get total storage used
 */
export const getStorageUsed = async (): Promise<number> => {
  const items = await listMedia();
  return items.reduce((total, item) => total + item.size, 0);
};

/**
 * Clear all media (use with caution)
 */
export const clearAllMedia = async (): Promise<void> => {
  const db = await openDB();

  // Revoke all cached URLs
  objectURLCache.forEach((url) => URL.revokeObjectURL(url));
  objectURLCache.clear();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear media'));
  });
};

/**
 * Cleanup unused object URLs (call periodically to free memory)
 */
export const cleanupObjectURLs = (activeIds: string[]): void => {
  const activeSet = new Set(activeIds);

  objectURLCache.forEach((url, id) => {
    if (!activeSet.has(id)) {
      URL.revokeObjectURL(url);
      objectURLCache.delete(id);
    }
  });
};

// Initialize DB on module load
openDB().catch(console.error);
