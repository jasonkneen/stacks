import { useState, useCallback, useRef, useMemo } from 'react';

interface UseUndoRedoOptions<T> {
  maxHistory?: number;
  initialState: T | (() => T);
}

export function useUndoRedo<T>({ maxHistory = 50, initialState }: UseUndoRedoOptions<T>) {
  // Initialize history once with lazy initialization
  const [history, setHistory] = useState<T[]>(() => {
    const initial = typeof initialState === 'function' ? (initialState as () => T)() : initialState;
    return [initial];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  const currentState = history[currentIndex];

  // Add new state to history
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    // Skip if this is an undo/redo action
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    setHistory(prev => {
      const actualNewState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prev[currentIndex])
        : newState;

      // Don't add if state hasn't changed
      if (JSON.stringify(actualNewState) === JSON.stringify(prev[currentIndex])) {
        return prev;
      }

      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, currentIndex + 1);

      // Add new state
      newHistory.push(actualNewState);

      // Keep only last maxHistory states
      if (newHistory.length > maxHistory) {
        return newHistory.slice(newHistory.length - maxHistory);
      }

      return newHistory;
    });

    setCurrentIndex(prev => {
      const newIndex = prev + 1;
      // Adjust if we exceeded maxHistory
      return Math.min(newIndex, maxHistory - 1);
    });
  }, [currentIndex, maxHistory]);

  // Undo
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isUndoRedoAction.current = true;
      setCurrentIndex(prev => prev - 1);
      console.log('[undo] Going back to state', currentIndex - 1);
    } else {
      console.log('[undo] Already at oldest state');
    }
  }, [currentIndex]);

  // Redo
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      setCurrentIndex(prev => prev + 1);
      console.log('[redo] Going forward to state', currentIndex + 1);
    } else {
      console.log('[redo] Already at newest state');
    }
  }, [currentIndex, history.length]);

  // Can undo/redo
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    state: currentState,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
  };
}
