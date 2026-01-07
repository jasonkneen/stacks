import { useState, useEffect, useCallback } from 'react';

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const STORAGE_KEY = 'content-zoom';

export function useContentZoom() {
  const [contentZoom, setContentZoom] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(contentZoom));
  }, [contentZoom]);

  const zoomIn = useCallback(() => {
    setContentZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setContentZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setContentZoom(1.0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  return {
    contentZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setContentZoom
  };
}
