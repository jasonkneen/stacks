import React from 'react';
import { Trash2 } from 'lucide-react';
import { SpatialItem } from '../types';

interface Props {
  selection: Set<string>;
  items: SpatialItem[];
  onUpdateItem: (id: string, changes: Partial<SpatialItem>) => void;
  onDelete: (ids: Set<string>) => void;
}

const COLORS = [
  { class: 'bg-yellow-200', label: 'Yellow' },
  { class: 'bg-blue-200', label: 'Blue' },
  { class: 'bg-green-200', label: 'Green' },
  { class: 'bg-pink-200', label: 'Pink' },
  { class: 'bg-orange-200', label: 'Orange' },
  { class: 'bg-gray-100', label: 'White' },
];

export const ContextToolbar: React.FC<Props> = ({ selection, items, onUpdateItem, onDelete }) => {
  const isVisible = selection.size > 0;
  
  // Calculate if we should show color picker
  const selectedItems = items.filter(i => selection.has(i.id));
  const hasSticky = selectedItems.some(i => i.type === 'sticky');
  
  // Common visual wrapper
  // Using fixed position bottom-center, sliding up when active
  return (
    <div 
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-400 cubic-bezier(0.16, 1, 0.3, 1) ${
            isVisible 
                ? 'translate-y-0 opacity-100 scale-100' 
                : 'translate-y-20 opacity-0 scale-95 pointer-events-none'
        }`}
    >
      <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 ring-1 ring-black/5">
        
        {/* Color Picker (Only if stickies are involved) */}
        {hasSticky && (
            <>
                <div className="flex items-center gap-2">
                    {COLORS.map((color) => (
                        <button
                            key={color.class}
                            onClick={() => {
                                selectedItems.forEach(item => {
                                    if (item.type === 'sticky') {
                                        onUpdateItem(item.id, { color: color.class });
                                    }
                                });
                            }}
                            className={`w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-125 active:scale-90 ${color.class}`}
                            title={color.label}
                        />
                    ))}
                </div>
                <div className="w-px h-5 bg-gray-300 mx-1" />
            </>
        )}

        {/* Selected Count / Context Label (Optional, for now just item count if > 1) */}
        {selection.size > 1 && (
             <span className="text-xs font-semibold text-gray-500 tabular-nums px-1">
                 {selection.size} items
             </span>
        )}
        {selection.size > 1 && <div className="w-px h-5 bg-gray-300 mx-1" />}

        {/* Common Actions */}
        <button 
            onClick={() => onDelete(selection)}
            className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors group"
            title="Delete"
        >
            <Trash2 size={18} className="transition-transform group-hover:scale-110 group-active:scale-95" />
        </button>
      </div>
    </div>
  );
};