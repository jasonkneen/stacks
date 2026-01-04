import React from 'react';
import { SpatialItem } from '../types';

interface Props {
  item: SpatialItem;
  onChange: (val: string) => void;
}

export const StickyComponent: React.FC<Props> = ({ item, onChange }) => {
  // Default to yellow if no color is set
  const bgColor = item.color || 'bg-yellow-200';
  
  // Determine placeholder color based on background to ensure contrast (simplified logic)
  const isDark = bgColor.includes('gray-800') || bgColor.includes('black');
  const placeholderColor = isDark ? 'placeholder-white/40 text-white' : 'placeholder-yellow-600/50 text-gray-800';

  return (
    <div className={`w-full h-full p-4 flex flex-col transition-colors duration-300 ${bgColor}`}>
      <textarea
        className={`w-full h-full bg-transparent resize-none border-none outline-none font-handwriting text-lg leading-snug ${placeholderColor}`}
        value={item.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a thought..."
        onMouseDown={(e) => e.stopPropagation()} // Allow interaction with text without dragging immediately
      />
    </div>
  );
};