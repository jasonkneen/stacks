import React, { useState } from 'react';
import { Plus, StickyNote, Image as ImageIcon, Type, Layers, LayoutGrid, Droplet, FolderPlus, Trash2, X } from 'lucide-react';
import { ItemType } from '../types';
import { SpaceIndicator } from './SpaceIndicator';
import { Space } from '../types';

interface Props {
  onAddItem: (type: ItemType) => void;
  onAutoLayout: () => void;
  onNewSpace: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  isLayouting: boolean;
  spaces: Space[];
  activeSpaceId: string;
  onNavigateSpace: (spaceId: string) => void;
}

export const Toolbar: React.FC<Props> = ({
  onAddItem,
  onAutoLayout,
  onNewSpace,
  onDeleteSelected,
  hasSelection,
  isLayouting,
  spaces,
  activeSpaceId,
  onNavigateSpace
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const btnClass = "p-3 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95 duration-150";
  const addBtnClass = "p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center gap-2";

  return (
    <>
      {/* Main Dark Toolbar - Bottom Center */}
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

      {/* Creation Buttons - Bottom Right */}
      <div className="absolute bottom-8 right-8 flex items-center gap-3 z-50">
        {/* Space Indicator */}
        {spaces.length > 1 && (
          <div className="bg-gray-900/95 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-xl border border-white/10">
            <SpaceIndicator
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onNavigate={onNavigateSpace}
            />
          </div>
        )}

        {/* Add Menu Dropdown */}
        {showAddMenu && (
          <div className="absolute bottom-16 right-0 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-2 flex flex-col gap-1 min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              className={addBtnClass}
              onClick={() => { onAddItem('sticky'); setShowAddMenu(false); }}
            >
              <StickyNote size={18} />
              <span className="text-sm">Sticky Note</span>
            </button>
            <button
              className={addBtnClass}
              onClick={() => { onAddItem('note'); setShowAddMenu(false); }}
            >
              <Type size={18} />
              <span className="text-sm">Note</span>
            </button>
            <button
              className={addBtnClass}
              onClick={() => { onAddItem('image'); setShowAddMenu(false); }}
            >
              <ImageIcon size={18} />
              <span className="text-sm">Image</span>
            </button>
            <button
              className={addBtnClass}
              onClick={() => { onAddItem('folder'); setShowAddMenu(false); }}
            >
              <FolderPlus size={18} />
              <span className="text-sm">Folder</span>
            </button>
          </div>
        )}

        <button
          className={`bg-gray-900 text-white p-3.5 rounded-full hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 ${showAddMenu ? 'rotate-45' : ''}`}
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          {showAddMenu ? <X size={22} /> : <Plus size={22} />}
        </button>
      </div>

      {/* Click outside to close */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </>
  );
};
