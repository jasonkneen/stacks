import React, { useState } from 'react';
import { LayoutGrid, Layers, Shuffle, ChevronDown, ArrowUpDown } from 'lucide-react';
import { LayoutType, SortOption } from '../types';

interface AutoArrangeButtonProps {
  layoutType: LayoutType;
  sortBy: SortOption;
  onLayoutChange: (layout: LayoutType) => void;
  onSortChange: (sort: SortOption) => void;
  onArrange: () => void;
  hasSelection: boolean;
}

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'bento', label: 'Bento', icon: Layers },
  { value: 'random', label: 'Random', icon: Shuffle },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Last Updated' },
  { value: 'added', label: 'Date Added' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
];

export const AutoArrangeButton: React.FC<AutoArrangeButtonProps> = ({
  layoutType,
  sortBy,
  onLayoutChange,
  onSortChange,
  onArrange,
  hasSelection,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const currentLayout = LAYOUT_OPTIONS.find(l => l.value === layoutType);
  const LayoutIcon = currentLayout?.icon || LayoutGrid;

  return (
    <div className="flex items-center gap-0.5 bg-white/40 backdrop-blur-md rounded-full p-1 shadow-lg border border-white/60">
      {/* Execution Button */}
      <button
        onClick={() => {
          onArrange();
          setShowMenu(false);
        }}
        className="p-2 rounded-full bg-gray-800/10 text-gray-800 hover:bg-gray-800/15 transition-all"
        title={`Auto-arrange ${hasSelection ? 'selected items' : 'all items'} using ${currentLayout?.label} layout`}
      >
        <LayoutIcon size={18} />
      </button>

      {/* Options Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-full text-gray-800 hover:text-gray-900 hover:bg-gray-800/10 transition-all"
          title="Arrangement options"
        >
          <ChevronDown size={18} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute top-full mt-2 right-0 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 overflow-hidden z-50 min-w-[180px]">
              {/* Layout Section */}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200/50">
                Layout
              </div>
              {LAYOUT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onLayoutChange(option.value);
                      setShowMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                      layoutType === option.value
                        ? 'bg-gray-800/10 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-800/5 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}

              {/* Sort Section */}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-200/50">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown size={12} />
                  Sort By
                </div>
              </div>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setShowMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    sortBy === option.value
                      ? 'bg-gray-800/10 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-800/5 hover:text-gray-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
