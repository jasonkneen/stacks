import React, { useState } from 'react';
import { Trash2, FolderPlus, FolderOpen, Layers, LayoutGrid, Droplet } from 'lucide-react';
import { SpatialItem } from '../types';

interface Props {
  selection: Set<string>;
  items: SpatialItem[];
  onUpdateItem: (id: string, changes: Partial<SpatialItem>) => void;
  onDelete: (ids: Set<string>) => void;
  onGroupToStack: (ids: Set<string>) => void;
  onUngroup: (folderId: string) => void;
}

const COLORS = [
  { class: 'bg-yellow-200', hex: '#fef08a', label: 'Yellow' },
  { class: 'bg-blue-200', hex: '#bfdbfe', label: 'Blue' },
  { class: 'bg-green-200', hex: '#bbf7d0', label: 'Green' },
  { class: 'bg-pink-200', hex: '#fbcfe8', label: 'Pink' },
  { class: 'bg-orange-200', hex: '#fed7aa', label: 'Orange' },
  { class: 'bg-gray-100', hex: '#f3f4f6', label: 'White' },
];

export const ContextToolbar: React.FC<Props> = ({
  selection,
  items,
  onUpdateItem,
  onDelete,
  onGroupToStack,
  onUngroup
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isVisible = selection.size > 0;

  const selectedItems = items.filter(i => selection.has(i.id));
  const hasSticky = selectedItems.some(i => i.type === 'sticky');
  const singleFolder = selection.size === 1 && selectedItems[0]?.type === 'folder' ? selectedItems[0] : null;

  const btnClass = "p-3 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95 duration-150 relative";

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-12 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="bg-gray-900/95 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-1">

        {/* Stack/Group (Multiple items) */}
        {selection.size > 1 && (
          <button
            onClick={() => onGroupToStack(selection)}
            className={btnClass}
            title="Group to Stack"
          >
            <Layers size={20} />
          </button>
        )}

        {/* Ungroup (Single folder) */}
        {singleFolder && singleFolder.linkedSpaceId && (
          <button
            onClick={() => onUngroup(singleFolder.id)}
            className={btnClass}
            title="Ungroup"
          >
            <FolderOpen size={20} />
          </button>
        )}

{/* Color Picker (Stickies only) */}
        {hasSticky && (
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`${btnClass} ${showColorPicker ? 'bg-white/10 text-white' : ''}`}
            title="Change Color"
          >
            <Droplet size={20} />

            {/* Color Picker Dropdown */}
            {showColorPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-3 flex items-center gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.class}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectedItems.forEach(item => {
                        if (item.type === 'sticky') {
                          onUpdateItem(item.id, { color: color.class });
                        }
                      });
                      setShowColorPicker(false);
                    }}
                    className="w-8 h-8 rounded-lg border-2 border-white/20 transition-all hover:scale-110 active:scale-95 hover:border-white/40"
                    style={{ backgroundColor: color.hex }}
                    title={color.label}
                  />
                ))}
              </div>
            )}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(selection)}
          className={`${btnClass} text-red-400 hover:text-red-300 hover:bg-red-500/20`}
          title="Delete"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Click outside to close color picker */}
      {showColorPicker && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
};
