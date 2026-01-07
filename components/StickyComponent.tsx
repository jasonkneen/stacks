import React, { useRef, useEffect, memo } from 'react';
import { SpatialItem } from '../types';

interface Props {
  item: SpatialItem;
  onChange: (val: string) => void;
  contentZoom?: number;
}

export const StickyComponent: React.FC<Props> = memo(({ item, onChange, contentZoom = 1 }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const bgColor = item.color || 'bg-yellow-200';

  const isDark = bgColor.includes('gray-800') || bgColor.includes('black');
  const textColor = isDark ? 'text-white' : 'text-gray-800';

  // Sync content from props
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== item.content) {
      contentRef.current.innerHTML = item.content;
    }
  }, [item.content]);

  const handleInput = () => {
    if (contentRef.current) {
      onChange(contentRef.current.innerHTML);
    }
  };

  return (
    <div className={`w-full h-full p-4 flex flex-col transition-colors duration-300 ${bgColor}`}>
      <div
        ref={contentRef}
        className={`w-full h-full bg-transparent resize-none border-none outline-none font-handwriting leading-snug ${textColor}`}
        style={{ fontSize: `${contentZoom}rem` }}
        contentEditable
        onInput={handleInput}
        onMouseDown={(e) => e.stopPropagation()}
        suppressContentEditableWarning
      />

      <style>{`
        [contenteditable]:empty:before {
          content: 'Write a thought...';
          color: ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(202,138,4,0.5)'};
          pointer-events: none;
        }
        .font-handwriting p { margin-bottom: 0.5em; }
        .font-handwriting strong { font-weight: 700; }
        .font-handwriting em { font-style: italic; }
      `}</style>
    </div>
  );
});