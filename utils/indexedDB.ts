// IndexedDB for large media storage (images/videos)
const DB_NAME = 'scratchpad-media';
const STORE_NAME = 'media';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
export const initMediaDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save media (image/video) to IndexedDB
export const saveMediaToIndexedDB = async (itemId: string, dataUrl: string): Promise<void> => {
  const db = await initMediaDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: itemId, dataUrl, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Load media from IndexedDB
export const loadMediaFromIndexedDB = async (itemId: string): Promise<string | null> => {
  const db = await initMediaDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(itemId);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.dataUrl : null);
    };
    request.onerror = () => reject(request.error);
  });
};

// Delete media from IndexedDB
export const deleteMediaFromIndexedDB = async (itemId: string): Promise<void> => {
  const db = await initMediaDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(itemId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Clear all media
export const clearAllMedia = async (): Promise<void> => {
  const db = await initMediaDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
