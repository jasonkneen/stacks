import React from 'react';
import { Space } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  spaces: Space[];
  activeSpaceId: string;
  onNavigate: (spaceId: string) => void;
}

export const SpaceIndicator: React.FC<Props> = ({ spaces, activeSpaceId, onNavigate }) => {
  const activeIndex = spaces.findIndex(s => s.id === activeSpaceId);

  const goToPrev = () => {
    if (activeIndex > 0) {
      onNavigate(spaces[activeIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (activeIndex < spaces.length - 1) {
      onNavigate(spaces[activeIndex + 1].id);
    }
  };

  if (spaces.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 z-40">
      {/* Previous button */}
      <button
        onClick={goToPrev}
        disabled={activeIndex === 0}
        className={`p-2 rounded-full transition-all ${
          activeIndex === 0
            ? 'opacity-0 cursor-not-allowed'
            : 'bg-gray-800/50 hover:bg-gray-700 text-white shadow-lg'
        }`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Space dots */}
      <div className="flex items-center gap-1.5 px-2">
        {spaces.map((space, index) => (
          <button
            key={space.id}
            onClick={() => onNavigate(space.id)}
            className={`transition-all duration-300 rounded-full ${
              space.id === activeSpaceId
                ? 'w-6 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
            }`}
            title={space.name}
          />
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={goToNext}
        disabled={activeIndex === spaces.length - 1}
        className={`p-2 rounded-full transition-all ${
          activeIndex === spaces.length - 1
            ? 'opacity-0 cursor-not-allowed'
            : 'bg-gray-800/50 hover:bg-gray-700 text-white shadow-lg'
        }`}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
