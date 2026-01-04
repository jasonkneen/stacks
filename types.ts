export type ItemType = 'sticky' | 'note' | 'image' | 'video' | 'folder';

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
    size?: string;
    duration?: string;
    fps?: string;
    resolution?: string;
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