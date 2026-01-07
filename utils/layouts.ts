import { SpatialItem, SortOption, LayoutType } from '../types';

// Grid and layout constants
export const LAYOUT_CONSTANTS = {
  GRID_CELL_SIZE: 220,
  GRID_GAP: 40,
  get GRID_SLOT_SIZE() {
    return this.GRID_CELL_SIZE + this.GRID_GAP;
  },
  BENTO_GAP: 20,
  BENTO_SMALL: 180,
  BENTO_LARGE_W: 400,
  BENTO_LARGE_H: 280,
  BENTO_COLS: 3,
  RANDOM_SPREAD: 400,
  RANDOM_SIZE_MIN: 160,
  RANDOM_SIZE_MAX: 280,
};

// Sort items by the given option
export const sortItems = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return (b.metadata?.updatedAt || 0) - (a.metadata?.updatedAt || 0);
      case 'added':
        return (b.metadata?.createdAt || 0) - (a.metadata?.createdAt || 0);
      case 'name':
        return (a.content || '').localeCompare(b.content || '');
      case 'type':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });
};

// Measure note content and calculate optimal grid size
export const measureNoteContent = (item: SpatialItem): { gridCellsX: number; gridCellsY: number } => {
  if (item.type !== 'note') {
    return {
      gridCellsX: item.metadata?.gridCellsX || 1,
      gridCellsY: item.metadata?.gridCellsY || 1
    };
  }

  // Create temporary element to measure content
  const temp = document.createElement('div');
  try {
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.width = '600px';
    temp.style.padding = '16px';
    temp.style.fontSize = '16px';
    temp.style.lineHeight = '1.6';
    // Sanitize content before setting innerHTML to prevent XSS
    temp.textContent = item.content.replace(/<[^>]*>/g, ' ');
    document.body.appendChild(temp);

    const contentHeight = temp.scrollHeight;
    const { GRID_CELL_SIZE, GRID_GAP, GRID_SLOT_SIZE } = LAYOUT_CONSTANTS;

    const gridCellsX = Math.min(10, Math.max(1, Math.ceil((600 + GRID_GAP) / GRID_SLOT_SIZE)));
    const gridCellsY = Math.min(8, Math.max(1, Math.ceil((contentHeight + GRID_GAP) / GRID_SLOT_SIZE)));

    return { gridCellsX, gridCellsY };
  } finally {
    if (temp.parentNode) {
      document.body.removeChild(temp);
    }
  }
};

// Grid Layout: Respects custom grid cell sizes
export const arrangeGrid = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);
  const { GRID_CELL_SIZE, GRID_GAP, GRID_SLOT_SIZE } = LAYOUT_CONSTANTS;

  const COLS = Math.ceil(Math.sqrt(items.length * 1.5));
  let currentCol = 0;
  let currentRow = 0;
  let maxRowHeight = 0;

  const arranged = sorted.map((item) => {
    const { gridCellsX: gridW, gridCellsY: gridH } = measureNoteContent(item);

    const w = gridW * GRID_SLOT_SIZE - GRID_GAP;
    const h = gridH * GRID_SLOT_SIZE - GRID_GAP;

    const x = currentCol * GRID_SLOT_SIZE;
    const y = currentRow * GRID_SLOT_SIZE;

    currentCol += gridW;
    maxRowHeight = Math.max(maxRowHeight, gridH);

    if (currentCol >= COLS) {
      currentCol = 0;
      currentRow += maxRowHeight;
      maxRowHeight = 0;
    }

    return {
      ...item,
      x,
      y,
      w,
      h,
      rotation: 0,
      metadata: {
        ...item.metadata,
        gridCellsX: gridW,
        gridCellsY: gridH
      }
    };
  });

  // Center the grid
  const minX = Math.min(...arranged.map(i => i.x));
  const maxX = Math.max(...arranged.map(i => i.x + i.w));
  const minY = Math.min(...arranged.map(i => i.y));
  const maxY = Math.max(...arranged.map(i => i.y + i.h));

  const rawOffsetX = -(minX + maxX) / 2;
  const rawOffsetY = -(minY + maxY) / 2;

  const offsetX = Math.round(rawOffsetX / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;
  const offsetY = Math.round(rawOffsetY / GRID_SLOT_SIZE) * GRID_SLOT_SIZE;

  return arranged.map(item => ({ ...item, x: item.x + offsetX, y: item.y + offsetY }));
};

// Bento Layout: Masonry-style with varied sizes
export const arrangeBento = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);
  const { BENTO_GAP: GAP, BENTO_SMALL: SMALL, BENTO_LARGE_W: LARGE_W, BENTO_LARGE_H: LARGE_H, BENTO_COLS: COLS } = LAYOUT_CONSTANTS;

  const colHeights = new Array(COLS).fill(0);

  const arranged = sorted.map((item, index) => {
    const { gridCellsX, gridCellsY } = measureNoteContent(item);
    const hasCustomSize = item.metadata?.gridCellsX || item.metadata?.gridCellsY;
    const isLarge = hasCustomSize || index % 4 === 0;

    const w = isLarge ? LARGE_W : SMALL;
    const h = isLarge ? LARGE_H : SMALL;

    const minHeight = Math.min(...colHeights);
    const col = colHeights.indexOf(minHeight);
    const x = -((COLS * SMALL + (COLS - 1) * GAP) / 2) + col * (SMALL + GAP);
    const y = colHeights[col];
    colHeights[col] += h + GAP;

    return {
      ...item,
      x,
      y,
      w,
      h,
      rotation: 0,
      metadata: {
        ...item.metadata,
        gridCellsX,
        gridCellsY
      }
    };
  });

  const maxHeight = Math.max(...colHeights);
  return arranged.map(item => ({ ...item, y: item.y - maxHeight / 2 }));
};

// Random Layout: Scattered with slight rotation
export const arrangeRandom = (items: SpatialItem[], sortBy: SortOption): SpatialItem[] => {
  if (items.length === 0) return items;

  const sorted = sortItems(items, sortBy);
  const { RANDOM_SPREAD: SPREAD, RANDOM_SIZE_MIN: SIZE_MIN, RANDOM_SIZE_MAX: SIZE_MAX, GRID_SLOT_SIZE } = LAYOUT_CONSTANTS;

  let seed = items.length;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return sorted.map((item) => {
    const { gridCellsX, gridCellsY } = measureNoteContent(item);
    const { GRID_GAP } = LAYOUT_CONSTANTS;

    const angle = seededRandom() * Math.PI * 2;
    const distance = seededRandom() * SPREAD;

    return {
      ...item,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      w: item.type === 'note' ? gridCellsX * GRID_SLOT_SIZE - GRID_GAP : SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN),
      h: item.type === 'note' ? gridCellsY * GRID_SLOT_SIZE - GRID_GAP : SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN),
      rotation: (seededRandom() - 0.5) * 10,
      metadata: {
        ...item.metadata,
        gridCellsX,
        gridCellsY
      }
    };
  });
};

// Get layout function by type
export const getLayoutFunction = (layoutType: LayoutType) => {
  switch (layoutType) {
    case 'grid':
      return arrangeGrid;
    case 'bento':
      return arrangeBento;
    case 'random':
      return arrangeRandom;
    default:
      return arrangeGrid;
  }
};

// Utility to calculate best-fit view
export const getFitToViewParams = (items: SpatialItem[]) => {
  if (items.length === 0) return { x: 0, y: 0, zoom: 1 };

  const padding = 100;
  const minX = Math.min(...items.map(i => i.x));
  const maxX = Math.max(...items.map(i => i.x + i.w));
  const minY = Math.min(...items.map(i => i.y));
  const maxY = Math.max(...items.map(i => i.y + i.h));

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const scaleX = (screenW - padding * 2) / width;
  const scaleY = (screenH - padding * 2) / height;
  const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.5);

  return {
    x: -centerX * zoom,
    y: -centerY * zoom,
    zoom
  };
};
