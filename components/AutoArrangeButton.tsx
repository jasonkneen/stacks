import React, { useState } from 'react';
import { LayoutGrid, Layers, Shuffle, ChevronDown, ArrowUpDown, Move, ArrowRight, ArrowDown, Minimize2, Square, Maximize2 } from 'lucide-react';
import { LayoutType, SortOption, FlowDirection, ItemSpacing } from '../types';

interface AutoArrangeButtonProps {
  layoutType: LayoutType;
  sortBy: SortOption;
  flowDirection: FlowDirection;
  itemSpacing: ItemSpacing;
  onLayoutChange: (layout: LayoutType) => void;
  onSortChange: (sort: SortOption) => void;
  onFlowChange: (flow: FlowDirection) => void;
  onSpacingChange: (spacing: ItemSpacing) => void;
  onArrange: () => void;
}

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'free', label: 'Free', icon: Move },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'bento', label: 'Bento', icon: Layers },
  { value: 'random', label: 'Scatter', icon: Shuffle },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated', label: 'Last Updated' },
  { value: 'added', label: 'Date Added' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
];

const FLOW_OPTIONS: { value: FlowDirection; label: string; icon: typeof ArrowRight }[] = [
  { value: 'vertical', label: 'Horizontal', icon: ArrowRight },
  { value: 'horizontal', label: 'Vertical', icon: ArrowDown },
];

const SPACING_OPTIONS: { value: ItemSpacing; label: string; icon: typeof Square }[] = [
  { value: 'compact', label: 'Compact', icon: Minimize2 },
  { value: 'comfortable', label: 'Comfortable', icon: Square },
  { value: 'spacious', label: 'Spacious', icon: Maximize2 },
];

export const AutoArrangeButton: React.FC<AutoArrangeButtonProps> = ({
  layoutType,
  sortBy,
  flowDirection,
  itemSpacing,
  onLayoutChange,
  onSortChange,
  onFlowChange,
  onSpacingChange,
  onArrange,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const currentLayout = LAYOUT_OPTIONS.find(l => l.value === layoutType);
  const LayoutIcon = currentLayout?.icon || LayoutGrid;
  const isFreeMode = layoutType === 'free';

  return (
    <div className="flex items-center gap-0.5 bg-white/40 backdrop-blur-md rounded-full p-1 shadow-lg border border-white/60">
      {/* Execution Button */}
      <button
        onClick={() => {
          if (!isFreeMode) {
            onArrange();
          }
          setShowMenu(false);
        }}
        disabled={isFreeMode}
        className={`p-2 rounded-full transition-all ${
          isFreeMode
            ? 'text-gray-400 cursor-default'
            : 'bg-gray-800/10 text-gray-800 hover:bg-gray-800/15'
        }`}
        title={isFreeMode ? 'Free placement mode - no auto-arrange' : `Auto-arrange all items using ${currentLayout?.label} layout`}
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
            <div className="absolute top-full mt-2 right-0 bg-white/70 backdrop-blur-xl rounded-xl shadow-2xl border border-white/60 overflow-hidden z-[9999] min-w-[180px]">
              <div className="px-3 py-2 text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-white/40">
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
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2 ${
                      layoutType === option.value
                        ? 'bg-gray-800/15 text-gray-900'
                        : 'text-gray-800 hover:bg-gray-800/10 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}

              {(layoutType === 'grid' || layoutType === 'bento') && (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-gray-800 uppercase tracking-wide border-t border-white/40">
                    Flow
                  </div>
                  <div className="flex gap-1 px-3 pb-2">
                    {FLOW_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => onFlowChange(option.value)}
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                            flowDirection === option.value
                              ? 'bg-gray-800 text-white'
                              : 'bg-white/60 text-gray-800 hover:bg-white/80'
                          }`}
                        >
                          <Icon size={12} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {(layoutType === 'grid' || layoutType === 'bento' || layoutType === 'random') && (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-gray-800 uppercase tracking-wide border-t border-white/40">
                    Spacing
                  </div>
                  <div className="flex gap-1 px-3 pb-2">
                    {SPACING_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => onSpacingChange(option.value)}
                          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                            itemSpacing === option.value
                              ? 'bg-gray-800 text-white'
                              : 'bg-white/60 text-gray-800 hover:bg-white/80'
                          }`}
                        >
                          <Icon size={10} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="px-3 py-2 text-xs font-bold text-gray-800 uppercase tracking-wide border-t border-white/40">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown size={12} />
                  Sort By
                </div>
              </div>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                    sortBy === option.value
                      ? 'bg-gray-800/15 text-gray-900'
                      : 'text-gray-800 hover:bg-gray-800/10 hover:text-gray-900'
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
