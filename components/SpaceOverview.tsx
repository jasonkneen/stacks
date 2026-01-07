import React, { useEffect, useRef, useState } from 'react';
import { Space, SpatialItem } from '../types';
import { SquarePlus, X } from 'lucide-react';

interface Props {
  spaces: Space[];
  activeSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onDeleteSpace: (spaceId: string) => void;
}

export const SpaceOverview: React.FC<Props> = ({ spaces, activeSpaceId, onSelectSpace, onCreateSpace, onDeleteSpace }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Auto-scroll to active space
  useEffect(() => {
    if (activeCardRef.current && containerRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeSpaceId]);
  // Render a mini preview of items in a space
  const renderSpacePreview = (space: Space) => {
    if (space.items.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
          Empty space
        </div>
      );
    }

    // Show first few items as thumbnails
    return (
      <div className="w-full h-full relative">
        {space.items.slice(0, 6).map((item, index) => (
          <div
            key={item.id}
            className="absolute bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
            style={{
              left: `${10 + (index % 3) * 30}%`,
              top: `${10 + Math.floor(index / 3) * 40}%`,
              width: '25%',
              height: '30%',
              transform: `rotate(${(Math.random() - 0.5) * 6}deg)`,
            }}
          >
            {renderItemPreview(item)}
          </div>
        ))}
      </div>
    );
  };

  const renderItemPreview = (item: SpatialItem) => {
    switch (item.type) {
      case 'image':
        return <img src={item.content} className="w-full h-full object-cover" alt="" />;
      case 'video':
        return <div className="w-full h-full bg-gray-900" />;
      case 'sticky':
        return <div className={`w-full h-full ${item.color || 'bg-yellow-200'}`} />;
      case 'note':
        return <div className="w-full h-full bg-white" />;
      case 'folder':
        return <div className="w-full h-full bg-blue-50" />;
      default:
        return <div className="w-full h-full bg-gray-100" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center gap-12 px-20 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {spaces.map((space, index) => (
        <div
          key={space.id}
          ref={space.id === activeSpaceId ? activeCardRef : null}
          className={`relative cursor-pointer transition-all duration-300 flex-shrink-0 group/card ${
            space.id === activeSpaceId
              ? 'scale-105'
              : 'scale-100 hover:scale-102'
          }`}
          onClick={() => onSelectSpace(space.id)}
        >
          {/* Delete Button - Top Right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm(space.id);
            }}
            className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-white/40 backdrop-blur-xl border border-white/60 rounded-full shadow-lg hover:bg-red-500/80 transition-all opacity-0 group-hover/card:opacity-100 flex items-center justify-center"
            title="Delete space"
          >
            <X size={16} className="text-gray-700 hover:text-white" />
          </button>

          {/* Space Card */}
          <div
            className={`w-80 h-96 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 backdrop-blur-xl ${
              space.id === activeSpaceId
                ? 'ring-4 ring-blue-500/50 bg-white/40'
                : 'bg-white/30 hover:shadow-3xl hover:bg-white/40'
            }`}
            style={{
              border: '1px solid rgba(255,255,255,0.6)'
            }}
          >
            {/* Preview Area */}
            <div className="w-full h-full p-4">
              {renderSpacePreview(space)}
            </div>
          </div>

          {/* Space Name Badge */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 px-4 py-2 rounded-full shadow-xl">
              <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                {space.name}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Ghost Placeholder - New Space */}
      <div
        className="relative cursor-pointer transition-all duration-300 hover:scale-102 flex-shrink-0"
        onClick={onCreateSpace}
      >
        {/* Ghost Card with Dashed Border */}
        <div
          className="w-80 h-96 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl bg-white/20 backdrop-blur-xl hover:bg-white/30"
          style={{
            border: '2px dashed rgba(255, 255, 255, 0.5)'
          }}
        >
          {/* Center Icon */}
          <div className="w-full h-full flex items-center justify-center">
            <div className="rounded-2xl bg-white/30 p-6 transition-all duration-300 hover:bg-white/50">
              <SquarePlus size={48} className="text-white/70" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
          <div className="bg-white/40 backdrop-blur-xl border border-white/60 px-4 py-2 rounded-full shadow-xl">
            <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
              New Space
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 p-6 min-w-[320px]">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Space?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete "{spaces.find(s => s.id === deleteConfirm)?.name}" and all its contents.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteSpace(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
