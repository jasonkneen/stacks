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
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce saves (500ms delay)
      saveTimeoutRef.current = setTimeout(() => {
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
