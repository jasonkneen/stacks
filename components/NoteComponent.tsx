import React, { useRef, useState, useEffect, useMemo, memo } from 'react';
import { SpatialItem } from '../types';
import { Bold, Italic, Heading1, Heading2, List, Expand } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onChange: (val: string) => void;
  onOpenNote?: (rect: DOMRect) => void;
  contentZoom?: number;
}

export const NoteComponent: React.FC<Props> = memo(({ item, onChange, onOpenNote, contentZoom = 1 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const allowInlineEditing = false;
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract title from metadata or content (memoized to avoid DOMParser on every render)
  const title = useMemo(() => {
    // Use metadata title if available
    if (item.metadata?.title) return item.metadata.title as string;

    const parser = new DOMParser();
    const doc = parser.parseFromString(item.content, 'text/html');
    const h1 = doc.querySelector('h1');
    if (h1) return h1.textContent || 'Untitled';
    const h2 = doc.querySelector('h2');
    if (h2) return h2.textContent || 'Untitled';
    const text = doc.body.textContent || '';
    return text.slice(0, 30) + (text.length > 30 ? '...' : '') || 'Untitled';
  }, [item.content, item.metadata?.title]);

  const handleOpenViewer = () => {
    if (containerRef.current && onOpenNote) {
      onOpenNote(containerRef.current.getBoundingClientRect());
    }
  };
  
  // Sync content from props when not editing OR on initial mount
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== item.content) {
      // Only update if not currently editing to preserve cursor position
      if (!isEditing) {
        contentRef.current.innerHTML = item.content;
      }
    }
  }, [item.content, isEditing]);

  const handleInput = () => {
    if (contentRef.current) {
      onChange(contentRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    contentRef.current?.focus();
    // Force sync as some commands might not trigger input event immediately
    handleInput();
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white flex flex-col relative group"
    >
      {/* Title Bar - Double click to expand */}
      <div
        className="absolute top-0 left-0 w-full h-10 flex items-center justify-between px-4 bg-gradient-to-b from-gray-50/80 to-transparent z-10 cursor-pointer group/title"
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleOpenViewer();
        }}
      >
        <span className="text-xs font-medium text-gray-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenViewer();
          }}
          className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Expand note"
        >
          <Expand size={14} className="text-gray-400" />
        </button>
      </div>

       {/* Toolbar - Only visible when editing */}
      <div
        className={`absolute top-0 left-0 w-full h-12 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center px-4 gap-1 transition-all duration-200 z-20 ${
          isEditing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss when clicking toolbar buttons
      >
        <button onClick={() => execCmd('formatBlock', 'H1')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Heading 1">
            <Heading1 size={16} />
        </button>
        <button onClick={() => execCmd('formatBlock', 'H2')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Heading 2">
            <Heading2 size={16} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-2" />
        <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Bold">
            <Bold size={16} />
        </button>
        <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Italic">
            <Italic size={16} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-2" />
        <button onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="Bullet List">
            <List size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div
        className="w-full h-full overflow-y-auto rounded-3xl"
        // Stop propagation ONLY when editing to allow dragging when not editing.
        onMouseDown={(e) => isEditing && e.stopPropagation()}
        onDoubleClick={() => allowInlineEditing ? setIsEditing(true) : handleOpenViewer()}
      >
        <div
            ref={contentRef}
            className={`w-full min-h-full px-6 pt-8 pb-8 outline-none text-gray-800 leading-relaxed transition-all ease-out ${isEditing ? 'pt-16 cursor-text' : 'cursor-default pointer-events-none'}`}
            style={{ fontSize: `${contentZoom}rem` }}
            contentEditable={isEditing}
            onBlur={() => setIsEditing(false)}
            onInput={handleInput}
            suppressContentEditableWarning
        />
        
        <style>{`
          [contenteditable] h1, .note-content h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 0.5em; margin-top: 0; line-height: 1.2; }
          [contenteditable] h2, .note-content h2 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.5em; margin-top: 0.5em; line-height: 1.3; }
          [contenteditable] ul, .note-content ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
          [contenteditable] li, .note-content li { margin-bottom: 0.25em; }
          [contenteditable] p, .note-content p { margin-bottom: 0.75em; }
          [contenteditable]:empty:before { content: 'Start typing...'; color: #9ca3af; pointer-events: none; display: block; }
        `}</style>
      </div>
    </div>
  );
});
