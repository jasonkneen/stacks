export type ItemType = 'sticky' | 'note' | 'image' | 'video' | 'folder';

// Auto-arrange layout types
export type LayoutType = 'grid' | 'bento' | 'random' | 'free';
export type SortOption = 'updated' | 'added' | 'name' | 'type';
export type FlowDirection = 'horizontal' | 'vertical';
export type ItemSpacing = 'compact' | 'comfortable' | 'spacious';

export interface SpatialItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  rotation: number; // Added for natural scatter effect
  content: string; // Text for notes/stickies, URL for media, Name for folders
  color?: string; // Tailwind class for background color (e.g., 'bg-yellow-200')
  metadata?: {
    filename?: string;
    size?: string;
    duration?: string;
    fps?: string;
    resolution?: string;
    dimensions?: string;
    format?: string;
    dateTaken?: string;
    manuallyPositioned?: boolean;
    description?: string;
    colors?: string[];
    isAnalyzing?: boolean;
    isGenerating?: boolean;
    title?: string;
    createdAt?: number;
    updatedAt?: number;
    usedTools?: boolean;
    gridCellsX?: number;
    gridCellsY?: number;
    prompt?: string;
    imageResolution?: string;
    isVariant?: boolean;
    imageStyle?: string;
    originalId?: string;
  };
  linkedSpaceId?: string; // For folders
}

export interface Connection {
  id: string;
  from: string;
  to: string;
}

export interface Space {
  id: string;
  name: string;
  parentId: string | null;
  items: SpatialItem[];
  connections: Connection[];
  camera: { x: number; y: number; zoom: number };
  // Auto-arrange preferences (last used)
  layoutType?: LayoutType;
  sortBy?: SortOption;
  flowDirection?: FlowDirection;
  itemSpacing?: ItemSpacing;
}

export interface SelectionState {
  itemIds: Set<string>;
}

export const ITEM_DEFAULTS = {
  sticky: { w: 200, h: 200, bg: 'bg-yellow-200' },
  note: { w: 300, h: 400, bg: 'bg-white' },
  folder: { w: 160, h: 120, bg: 'bg-blue-100' },
  media: { w: 300, h: 200, bg: 'bg-gray-800' },
};