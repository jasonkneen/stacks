import { useEffect, useRef } from 'react';
import { Space } from '../types';
import { saveSpaces } from '../utils/storage';

export const useAutoSave = (spaces: Record<string, Space>, enabled: boolean = true) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousSpacesRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    const currentSpaces = JSON.stringify(spaces);

    // Only save if data has changed
    if (currentSpaces !== previousSpacesRef.current) {
      const totalItems = Object.values(spaces).reduce((sum, space) => sum + space.items.length, 0);
      console.log('[useAutoSave] State changed, scheduling save in 500ms:', {
        totalItems,
        hasTimeout: !!saveTimeoutRef.current
      });

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce saves (500ms delay)
      saveTimeoutRef.current = setTimeout(() => {
        console.log('[useAutoSave] Executing save now');
        saveSpaces(spaces);
        previousSpacesRef.current = currentSpaces;
      }, 500);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [spaces, enabled]);
};
