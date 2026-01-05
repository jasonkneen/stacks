import React, { useState } from 'react';
import { LayoutGrid, Layers, Shuffle, ChevronUp, ArrowUpDown } from 'lucide-react';
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
    <div className="flex items-center gap-0.5 bg-gray-900/95 backdrop-blur-xl rounded-2xl p-1.5 shadow-xl border border-white/10">
      {/* Execution Button */}
      <button
        onClick={() => {
          onArrange();
          setShowMenu(false);
        }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"
        title={`Auto-arrange ${hasSelection ? 'selected items' : 'all items'} using ${currentLayout?.label} layout`}
      >
        <LayoutIcon size={18} />
        <span className="text-sm font-medium">
          {hasSelection ? 'Arrange Selection' : 'Auto-arrange'}
        </span>
      </button>

      {/* Options Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all"
          title="Arrangement options"
        >
          <ChevronUp size={18} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 min-w-[180px]">
              {/* Layout Section */}
              <div className="px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wide border-b border-white/10">
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
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}

              {/* Sort Section */}
              <div className="px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wide border-t border-white/10">
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
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
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
