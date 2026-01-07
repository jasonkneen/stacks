import React, { useState } from 'react';
import { Trash2, FolderPlus, FolderOpen, Layers, LayoutGrid, Droplet, Sparkles, RefreshCw } from 'lucide-react';
import { SpatialItem, LayoutType, SortOption } from '../types';

interface Props {
  selection: Set<string>;
  items: SpatialItem[];
  onUpdateItem: (id: string, changes: Partial<SpatialItem>) => void;
  onDelete: (ids: Set<string>) => void;
  onGroupToStack: (ids: Set<string>) => void;
  onUngroup: (folderId: string) => void;
  onArrangeSelection: (layoutType: LayoutType, sortBy: SortOption) => void;
  onAIChat: (ids: Set<string>, position: { x: number; y: number }) => void;
  onRegenerate: (ids: Set<string>) => void;
  layoutType: LayoutType;
  sortBy: SortOption;
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
  onUngroup,
  onArrangeSelection,
  onAIChat,
  onRegenerate,
  layoutType,
  sortBy
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isVisible = selection.size > 0;

  const selectedItems = items.filter(i => selection.has(i.id));
  const hasSticky = selectedItems.some(i => i.type === 'sticky');
  const singleFolder = selection.size === 1 && selectedItems[0]?.type === 'folder' ? selectedItems[0] : null;
  const hasPrompt = selectedItems.some(i => i.metadata?.prompt);

  const btnClass = "p-2 rounded-2xl text-gray-800 hover:text-gray-900 hover:bg-gray-800/10 transition-all active:scale-95 duration-150 relative";

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-12 opacity-0 scale-95 pointer-events-none'
      }`}
      style={{ bottom: 18 }}
    >
      <div className="bg-white/40 backdrop-blur-md p-0.5 rounded-full shadow-lg border border-white/60 flex items-center gap-0.5">

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
            className={`${btnClass} ${showColorPicker ? 'bg-gray-800/15 text-gray-900' : ''}`}
            title="Change Color"
          >
            <Droplet size={20} />

            {/* Color Picker Dropdown */}
            {showColorPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-white/40 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-3 flex items-center gap-2">
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
                    className="w-8 h-8 rounded-lg border-2 border-gray-300/40 transition-all hover:scale-110 active:scale-95 hover:border-gray-400/60"
                    style={{ backgroundColor: color.hex }}
                    title={color.label}
                  />
                ))}
              </div>
            )}
          </button>
        )}

        {/* Auto-Arrange Selection (2+ items only) */}
        {selection.size >= 2 && (
          <button
            onClick={() => onArrangeSelection(layoutType, sortBy)}
            className={btnClass}
            title="Auto-arrange selected items"
          >
            <LayoutGrid size={20} />
          </button>
        )}

        {/* Regenerate (AI-generated items only) */}
        {hasPrompt && (
          <button
            onClick={() => onRegenerate(selection)}
            className={btnClass}
            title="Regenerate with original prompt"
          >
            <RefreshCw size={20} />
          </button>
        )}

        {/* AI Chat */}
        <button
          onClick={(e) => {
            // Get position for the popup (centered above the toolbar)
            const rect = e.currentTarget.getBoundingClientRect();
            onAIChat(selection, { x: window.innerWidth / 2, y: rect.top - 20 });
          }}
          className={btnClass}
          title="Ask AI about selection"
        >
          <Sparkles size={20} />
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(selection)}
          className="p-2 rounded-2xl text-gray-800 hover:text-red-600 hover:bg-red-500/10 transition-all active:scale-95 duration-150 relative"
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
