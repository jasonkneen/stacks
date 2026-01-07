import { useEffect, useRef } from 'react';
import { Space } from '../types';
import { saveSpaces } from '../utils/storage';

export const useAutoSave = (spaces: Record<string, Space>, enabled: boolean = true) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousSpacesRef = useRef<string>('');
  const renderCountRef = useRef(0);
  const spacesRef = useRef(spaces);
  const lastSaveRef = useRef<number>(0);

  // Always keep ref up-to-date with latest spaces
  useEffect(() => {
    spacesRef.current = spaces;
  }, [spaces]);

  useEffect(() => {
    if (!enabled) return;

    renderCountRef.current++;

    // Throttle expensive JSON.stringify calls to max once per 100ms
    const now = Date.now();
    if (now - lastSaveRef.current < 100) {
      return;
    }
    lastSaveRef.current = now;

    const currentSpaces = JSON.stringify(spaces);

    // Only save if data has ACTUALLY changed
    if (currentSpaces !== previousSpacesRef.current) {
      const totalItems = Object.values(spaces).reduce((sum, space) => sum + space.items.length, 0);

      // Log with render count to detect loops
      if (renderCountRef.current % 5 === 0) {
        console.log('[useAutoSave] State changed (render #' + renderCountRef.current + '), scheduling save in 500ms:', {
          totalItems,
          hasTimeout: !!saveTimeoutRef.current
        });
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce saves (500ms delay)
      // CRITICAL: Use spacesRef.current to get LATEST state, not closure
      saveTimeoutRef.current = setTimeout(() => {
        console.log('[useAutoSave] Executing save now (render #' + renderCountRef.current + ')');
        const latestSpaces = spacesRef.current;
        saveSpaces(latestSpaces).catch(err => console.error('[useAutoSave] Save failed:', err));
        previousSpacesRef.current = JSON.stringify(latestSpaces);
        renderCountRef.current = 0; // Reset counter after successful save
      }, 500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [spaces, enabled]);
};
