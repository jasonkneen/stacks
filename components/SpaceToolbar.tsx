import React from 'react';
import { Layers, LayoutGrid, Droplet, FolderPlus, Trash2 } from 'lucide-react';

interface Props {
  onAutoLayout: () => void;
  onNewSpace: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  isLayouting: boolean;
}

export const SpaceToolbar: React.FC<Props> = ({
  onAutoLayout,
  onNewSpace,
  onDeleteSelected,
  hasSelection,
  isLayouting
}) => {
  const btnClass = "p-3 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95 duration-150";

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-900/95 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/10 z-50">
      <button className={btnClass} title="Stack">
        <Layers size={20} />
      </button>

      <button
        className={btnClass}
        onClick={onAutoLayout}
        title="Organize"
      >
        <LayoutGrid size={20} />
      </button>

      <button className={btnClass} title="Color">
        <Droplet size={20} />
      </button>

      <button
        className={btnClass}
        onClick={onNewSpace}
        title="New Space"
      >
        <FolderPlus size={20} />
      </button>

      <button
        className={`${btnClass} ${hasSelection ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' : 'opacity-30 cursor-not-allowed'}`}
        onClick={hasSelection ? onDeleteSelected : undefined}
        title="Delete"
        disabled={!hasSelection}
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
};
