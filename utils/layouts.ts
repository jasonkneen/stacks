import { SpatialItem, SortOption, LayoutType, FlowDirection, ItemSpacing } from '../types';

export interface LayoutOptions {
  sortBy: SortOption;
  flowDirection?: FlowDirection;
  itemSpacing?: ItemSpacing;
}

const getSpacingMultiplier = (spacing: ItemSpacing = 'comfortable'): number => {
  switch (spacing) {
    case 'compact': return 0.3;
    case 'comfortable': return 1;
    case 'spacious': return 2.5;
    default: return 1;
  }
};

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

export const arrangeGrid = (items: SpatialItem[], options: LayoutOptions): SpatialItem[] => {
  if (items.length === 0) return items;

  const { sortBy, flowDirection = 'horizontal', itemSpacing = 'comfortable' } = options;
  const sorted = sortItems(items, sortBy);
  const spacingMult = getSpacingMultiplier(itemSpacing);
  const { GRID_CELL_SIZE, GRID_GAP } = LAYOUT_CONSTANTS;
  const adjustedGap = Math.round(GRID_GAP * spacingMult);
  const slotSize = GRID_CELL_SIZE + adjustedGap;

  const isHorizontal = flowDirection === 'horizontal';
  const TRACK_LIMIT = isHorizontal ? Math.ceil(Math.sqrt(items.length * 1.5)) : Math.ceil(Math.sqrt(items.length * 2.5));
  let currentCol = 0;
  let currentRow = 0;
  let maxTrackSize = 0;

  const arranged = sorted.map((item) => {
    const { gridCellsX: gridW, gridCellsY: gridH } = measureNoteContent(item);

    const w = gridW * slotSize - adjustedGap;
    const h = gridH * slotSize - adjustedGap;

    const x = currentCol * slotSize;
    const y = currentRow * slotSize;

    if (isHorizontal) {
      currentCol += gridW;
      maxTrackSize = Math.max(maxTrackSize, gridH);
      if (currentCol >= TRACK_LIMIT) {
        currentCol = 0;
        currentRow += maxTrackSize;
        maxTrackSize = 0;
      }
    } else {
      currentRow += gridH;
      maxTrackSize = Math.max(maxTrackSize, gridW);
      if (currentRow >= TRACK_LIMIT) {
        currentRow = 0;
        currentCol += maxTrackSize;
        maxTrackSize = 0;
      }
    }

    return { ...item, x, y, w, h, rotation: 0, metadata: { ...item.metadata, gridCellsX: gridW, gridCellsY: gridH } };
  });

  const minX = Math.min(...arranged.map(i => i.x));
  const maxX = Math.max(...arranged.map(i => i.x + i.w));
  const minY = Math.min(...arranged.map(i => i.y));
  const maxY = Math.max(...arranged.map(i => i.y + i.h));

  const offsetX = Math.round((-(minX + maxX) / 2) / slotSize) * slotSize;
  const offsetY = Math.round((-(minY + maxY) / 2) / slotSize) * slotSize;

  return arranged.map(item => ({ ...item, x: item.x + offsetX, y: item.y + offsetY }));
};

export const arrangeBento = (items: SpatialItem[], options: LayoutOptions): SpatialItem[] => {
  if (items.length === 0) return items;

  const { sortBy, flowDirection = 'horizontal', itemSpacing = 'comfortable' } = options;
  const sorted = sortItems(items, sortBy);
  const spacingMult = getSpacingMultiplier(itemSpacing);
  const GAP = Math.round(20 * spacingMult);
  const UNIT = 180;

  const isHorizontal = flowDirection === 'horizontal';
  const GRID_COLS = isHorizontal ? 4 : 3;
  const GRID_ROWS = isHorizontal ? 100 : 100;

  const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));

  const bentoSizes = [
    { w: 2, h: 2 },
    { w: 2, h: 1 },
    { w: 1, h: 2 },
    { w: 1, h: 1 },
  ];

  const findSlot = (cellW: number, cellH: number): { col: number; row: number } | null => {
    for (let row = 0; row < GRID_ROWS - cellH + 1; row++) {
      for (let col = 0; col < GRID_COLS - cellW + 1; col++) {
        let fits = true;
        for (let r = 0; r < cellH && fits; r++) {
          for (let c = 0; c < cellW && fits; c++) {
            if (grid[row + r][col + c]) fits = false;
          }
        }
        if (fits) return { col, row };
      }
    }
    return null;
  };

  const markSlot = (col: number, row: number, cellW: number, cellH: number) => {
    for (let r = 0; r < cellH; r++) {
      for (let c = 0; c < cellW; c++) {
        grid[row + r][col + c] = true;
      }
    }
  };

  const arranged = sorted.map((item, index) => {
    const { gridCellsX, gridCellsY } = measureNoteContent(item);
    
    let sizeIndex: number;
    if (index === 0) sizeIndex = 0;
    else if (index % 5 === 0) sizeIndex = 0;
    else if (index % 3 === 0) sizeIndex = Math.random() < 0.5 ? 1 : 2;
    else sizeIndex = 3;

    const size = bentoSizes[sizeIndex];
    let slot = findSlot(size.w, size.h);
    
    if (!slot) {
      for (let i = sizeIndex + 1; i < bentoSizes.length; i++) {
        slot = findSlot(bentoSizes[i].w, bentoSizes[i].h);
        if (slot) {
          Object.assign(size, bentoSizes[i]);
          break;
        }
      }
    }

    if (!slot) slot = { col: 0, row: 0 };
    markSlot(slot.col, slot.row, size.w, size.h);

    const w = size.w * UNIT + (size.w - 1) * GAP;
    const h = size.h * UNIT + (size.h - 1) * GAP;
    const x = slot.col * (UNIT + GAP);
    const y = slot.row * (UNIT + GAP);

    return { ...item, x, y, w, h, rotation: 0, metadata: { ...item.metadata, gridCellsX, gridCellsY } };
  });

  const minX = Math.min(...arranged.map(i => i.x));
  const maxX = Math.max(...arranged.map(i => i.x + i.w));
  const minY = Math.min(...arranged.map(i => i.y));
  const maxY = Math.max(...arranged.map(i => i.y + i.h));
  const offsetX = -(minX + maxX) / 2;
  const offsetY = -(minY + maxY) / 2;

  return arranged.map(item => ({ ...item, x: item.x + offsetX, y: item.y + offsetY }));
};

export const arrangeRandom = (items: SpatialItem[], options: LayoutOptions): SpatialItem[] => {
  if (items.length === 0) return items;

  const { sortBy, itemSpacing = 'comfortable' } = options;
  const sorted = sortItems(items, sortBy);
  const { RANDOM_SIZE_MIN: SIZE_MIN, RANDOM_SIZE_MAX: SIZE_MAX, GRID_CELL_SIZE, GRID_GAP } = LAYOUT_CONSTANTS;
  
  const scatterSpacing = itemSpacing === 'compact' ? 0.7 : itemSpacing === 'spacious' ? 1.6 : 1;
  const slotSize = GRID_CELL_SIZE + GRID_GAP;

  let seed = items.length;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const baseSpread = 180 * Math.sqrt(items.length) * scatterSpacing;
  const minGap = 60 * scatterSpacing;

  const positions: { x: number; y: number; w: number; h: number }[] = [];

  return sorted.map((item) => {
    const { gridCellsX, gridCellsY } = measureNoteContent(item);
    
    let w: number, h: number;
    if (item.type === 'note') {
      w = Math.max(item.w, gridCellsX * slotSize - GRID_GAP);
      h = Math.max(item.h, gridCellsY * slotSize - GRID_GAP);
    } else {
      w = item.w || SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN);
      h = item.h || SIZE_MIN + seededRandom() * (SIZE_MAX - SIZE_MIN);
    }

    let x: number, y: number;
    let attempts = 0;
    do {
      const angle = seededRandom() * Math.PI * 2;
      const distance = 100 + seededRandom() * baseSpread;
      x = Math.cos(angle) * distance;
      y = Math.sin(angle) * distance;
      attempts++;
    } while (
      attempts < 80 &&
      positions.some(p => {
        const dx = Math.abs(x - p.x);
        const dy = Math.abs(y - p.y);
        const overlapX = dx < (w + p.w) / 2 + minGap;
        const overlapY = dy < (h + p.h) / 2 + minGap;
        return overlapX && overlapY;
      })
    );

    positions.push({ x, y, w, h });

    return {
      ...item, x, y, w, h,
      rotation: (seededRandom() - 0.5) * 12,
      metadata: { ...item.metadata, gridCellsX, gridCellsY }
    };
  });
};

export const getLayoutFunction = (layoutType: LayoutType): (items: SpatialItem[], options: LayoutOptions) => SpatialItem[] => {
  switch (layoutType) {
    case 'grid': return arrangeGrid;
    case 'bento': return arrangeBento;
    case 'random': return arrangeRandom;
    default: return arrangeGrid;
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
