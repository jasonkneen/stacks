import React, { useRef, useState, useEffect } from 'react';
import { SpatialItem } from '../types';
import { Bold, Italic, Heading1, Heading2, List } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onChange: (val: string) => void;
}

export const NoteComponent: React.FC<Props> = ({ item, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Sync content from props when not editing
  useEffect(() => {
    if (contentRef.current && !isEditing && contentRef.current.innerHTML !== item.content) {
       contentRef.current.innerHTML = item.content;
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
      className="w-full h-full bg-white flex flex-col relative group"
      onDoubleClick={() => setIsEditing(true)}
    >
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
        className="w-full h-full overflow-y-auto"
        // Stop propagation ONLY when editing to allow dragging when not editing.
        // We allow double-click to bubble up if we wanted, but we handled it on the wrapper.
        onMouseDown={(e) => isEditing && e.stopPropagation()} 
      >
        <div
            ref={contentRef}
            className={`w-full min-h-full p-6 outline-none text-gray-800 text-base leading-relaxed transition-all ease-out ${isEditing ? 'pt-16 cursor-text' : 'cursor-default pointer-events-none'}`}
            contentEditable={isEditing}
            onBlur={() => setIsEditing(false)}
            onInput={handleInput}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: item.content }} // Initial render
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
};
