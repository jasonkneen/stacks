import React from 'react';
import { Space, SpatialItem } from '../types';

interface Props {
  spaces: Space[];
  activeSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
}

export const SpaceOverview: React.FC<Props> = ({ spaces, activeSpaceId, onSelectSpace }) => {
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
    <div className="w-full h-full flex items-center justify-center gap-12 px-20">
      {spaces.map((space, index) => (
        <div
          key={space.id}
          className={`relative cursor-pointer transition-all duration-300 ${
            space.id === activeSpaceId
              ? 'scale-105'
              : 'scale-100 hover:scale-102'
          }`}
          onClick={() => onSelectSpace(space.id)}
        >
          {/* Space Card */}
          <div
            className={`w-80 h-96 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
              space.id === activeSpaceId
                ? 'ring-4 ring-blue-500/50 bg-white'
                : 'bg-white/90 hover:shadow-3xl'
            }`}
            style={{
              border: '1px solid rgba(0,0,0,0.08)'
            }}
          >
            {/* Preview Area */}
            <div className="w-full h-full p-4 bg-gray-50">
              {renderSpacePreview(space)}
            </div>
          </div>

          {/* Space Name Badge */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
            <div className="bg-gray-900/90 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full shadow-xl">
              <span className="text-sm font-semibold text-white whitespace-nowrap">
                {space.name}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
