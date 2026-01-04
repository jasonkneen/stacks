import React from 'react';
import { Plus, StickyNote, Image as ImageIcon, FolderPlus, Type, LayoutGrid, Loader2, Zap } from 'lucide-react';
import { ItemType } from '../types';

interface Props {
  onAddItem: (type: ItemType) => void;
  onAutoLayout: () => void;
  isLayouting: boolean;
  onOpenAI: () => void;
}

export const Toolbar: React.FC<Props> = ({ onAddItem, onAutoLayout, isLayouting, onOpenAI }) => {
  const btnClass = "p-3 rounded-full hover:bg-gray-100 text-gray-700 transition-colors active:scale-95 duration-150 relative group";
  const tooltipClass = "absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-lg";

  return (
    <div className="absolute bottom-8 right-8 flex items-center gap-2 bg-white/90 backdrop-blur-2xl p-2.5 rounded-full shadow-2xl border border-white/50 z-50 ring-1 ring-black/5">
      
      {/* AI Button */}
      <button className="p-3 rounded-full hover:bg-blue-50 text-blue-600 transition-colors active:scale-95 duration-150 relative group" onClick={onOpenAI}>
        <Zap size={20} fill="currentColor" className="opacity-100" />
        <span className={tooltipClass}>AI Studio</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />
      
      {/* Layout Button */}
      <button className={btnClass} onClick={onAutoLayout} disabled={isLayouting}>
        {isLayouting ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <LayoutGrid size={20} />}
        <span className={tooltipClass}>Organize</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <button className={btnClass} onClick={() => onAddItem('sticky')}>
        <StickyNote size={20} />
        <span className={tooltipClass}>Sticky</span>
      </button>

      <button className={btnClass} onClick={() => onAddItem('note')}>
        <Type size={20} />
        <span className={tooltipClass}>Note</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <button className={btnClass} onClick={() => onAddItem('image')}>
        <ImageIcon size={20} />
        <span className={tooltipClass}>Image</span>
      </button>

      <button className={btnClass} onClick={() => onAddItem('folder')}>
        <FolderPlus size={20} />
        <span className={tooltipClass}>New Space</span>
      </button>

      <button className="bg-gray-900 text-white p-3.5 rounded-full hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 ml-2">
        <Plus size={22} />
      </button>
    </div>
  );
};