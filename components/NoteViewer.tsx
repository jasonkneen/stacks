import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SpatialItem } from '../types';
import { ArrowLeft, Type, Heading1, Heading2, AlignLeft, List, CheckSquare, Code, X, Plus } from 'lucide-react';

interface Props {
  item: SpatialItem;
  sourceRect: DOMRect | null;
  onClose: () => void;
  onUpdateContent: (content: string) => void;
}

interface BlockOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  action: () => void;
}

export const NoteViewer: React.FC<Props> = ({ item, sourceRect, onClose, onUpdateContent }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState(item.metadata?.title as string || 'Untitled');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [formatButtonPosition, setFormatButtonPosition] = useState<{ x: number; y: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Calculate target position (centered, large card)
  const getTargetRect = () => {
    const maxW = Math.min(window.innerWidth * 0.6, 800);
    const maxH = window.innerHeight * 0.85;

    return {
      x: (window.innerWidth - maxW) / 2,
      y: (window.innerHeight - maxH) / 2,
      w: maxW,
      h: maxH
    };
  };

  // Block formatting options
  const blockOptions: BlockOption[] = [
    {
      id: 'display',
      label: 'Display',
      icon: <Type size={18} />,
      shortcut: '⌘1',
      action: () => document.execCommand('formatBlock', false, 'h1')
    },
    {
      id: 'headline',
      label: 'Headline',
      icon: <Heading1 size={18} />,
      shortcut: '⌘2',
      action: () => document.execCommand('formatBlock', false, 'h2')
    },
    {
      id: 'subheader',
      label: 'Subheader',
      icon: <Heading2 size={18} />,
      shortcut: '⌘3',
      action: () => document.execCommand('formatBlock', false, 'h3')
    },
    {
      id: 'body',
      label: 'Body',
      icon: <AlignLeft size={18} />,
      shortcut: '⌘4',
      action: () => document.execCommand('formatBlock', false, 'p')
    },
    {
      id: 'list',
      label: 'List',
      icon: <List size={18} />,
      shortcut: '⌘L',
      action: () => document.execCommand('insertUnorderedList')
    },
    {
      id: 'task',
      label: 'Task',
      icon: <CheckSquare size={18} />,
      shortcut: '⌘T',
      action: () => insertTaskList()
    },
    {
      id: 'code',
      label: 'Code',
      icon: <Code size={18} />,
      shortcut: '⇧⌘C',
      action: () => document.execCommand('formatBlock', false, 'pre')
    }
  ];

  const insertTaskList = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const taskItem = document.createElement('div');
      taskItem.className = 'task-item';
      taskItem.innerHTML = '<input type="checkbox" /> <span contenteditable="true">Task item</span>';
      range.insertNode(taskItem);
    }
  };

  // Initialize content once
  useEffect(() => {
    if (contentRef.current && !contentRef.current.innerHTML) {
      contentRef.current.innerHTML = item.content;
    }
  }, []);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      // Focus content area after animation
      setTimeout(() => contentRef.current?.focus(), 100);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle Escape globally
    if (e.key === 'Escape') {
      if (showBlockMenu) {
        setShowBlockMenu(false);
      } else {
        handleClose();
      }
      return;
    }

    // Block menu navigation (only when menu is open)
    if (showBlockMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedBlockIndex(prev => (prev + 1) % blockOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedBlockIndex(prev => (prev - 1 + blockOptions.length) % blockOptions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        blockOptions[selectedBlockIndex].action();
        setShowBlockMenu(false);
      }
      return;
    }

    // Only handle format shortcuts when content is focused and modifier key is pressed
    const isContentFocused = contentRef.current?.contains(document.activeElement) || document.activeElement === contentRef.current;
    if (!isContentFocused) return;

    // Format shortcuts (Cmd/Ctrl + number)
    if (e.metaKey || e.ctrlKey) {
      if (e.key === '1') {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'h1');
      } else if (e.key === '2') {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'h2');
      } else if (e.key === '3') {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'h3');
      } else if (e.key === '4') {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'p');
      } else if (e.key === 'l') {
        e.preventDefault();
        document.execCommand('insertUnorderedList');
      } else if (e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        insertTaskList();
      } else if (e.key === 'c' && e.shiftKey) {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'pre');
      }
    }
  }, [showBlockMenu, selectedBlockIndex, blockOptions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Track cursor position for format button
  const updateFormatButtonPosition = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const cardRect = contentRef.current?.getBoundingClientRect();
      if (cardRect && rect.top > 0) {
        setFormatButtonPosition({
          x: cardRect.left - 40,
          y: rect.top + rect.height / 2 - 14
        });
      }
    }
  }, []);

  // Handle selection change
  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatButtonPosition);
    return () => document.removeEventListener('selectionchange', updateFormatButtonPosition);
  }, [updateFormatButtonPosition]);

  // Open format menu via button click
  const handleFormatButtonClick = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setBlockMenuPosition({
        x: rect.left,
        y: rect.bottom + 8
      });
      setShowBlockMenu(true);
      setSelectedBlockIndex(0);
    }
  };

  // Handle slash command
  const handleInput = (e: React.FormEvent) => {
    // For now, disable slash command to fix typing issues
    // Will implement properly later
    setShowBlockMenu(false);
  };

  const handleClose = () => {
    // Save content and title before closing
    if (contentRef.current) {
      onUpdateContent(contentRef.current.innerHTML);
    }
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  };

  const selectBlockOption = (option: BlockOption) => {
    option.action();
    setShowBlockMenu(false);
    contentRef.current?.focus();
  };

  const target = getTargetRect();
  const source = sourceRect || { x: target.x, y: target.y, width: target.w, height: target.h };

  // Determine current animation state
  const showAtSource = isAnimating || isClosing;

  const cardStyle: React.CSSProperties = showAtSource
    ? {
        position: 'fixed',
        left: source.x,
        top: source.y,
        width: source.width,
        height: source.height,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 110,
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }
    : {
        position: 'fixed',
        left: target.x,
        top: target.y,
        width: target.w,
        height: target.h,
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 110,
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-all duration-300 ${
        isClosing ? 'bg-black/0' : 'bg-black/60'
      } ${isAnimating ? 'bg-black/0' : ''}`}
      style={{ backdropFilter: isClosing || isAnimating ? 'blur(0px)' : 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowBlockMenu(false);
          handleClose();
        }
      }}
    >
      {/* Top Left Title Bar with Back Button */}
      <div
        className={`fixed left-6 top-6 z-[120] transition-all duration-300 ${
          isAnimating || isClosing ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-3 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>

          {isEditingTitle ? (
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-full px-5 py-2.5 shadow-2xl border border-white/10">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="bg-transparent text-white text-base font-medium outline-none min-w-[200px] placeholder-white/40"
                placeholder="Untitled"
              />
            </div>
          ) : (
            <div
              className="px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-lg cursor-pointer hover:bg-white transition-colors"
              onDoubleClick={() => setIsEditingTitle(true)}
            >
              <span className="text-gray-700 font-semibold text-sm">{title || 'Untitled'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Morphing Card */}
      <div style={cardStyle} className="bg-white flex flex-col">
        {/* Content Area */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-12 pt-8 note-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={() => {
            if (contentRef.current) {
              onUpdateContent(contentRef.current.innerHTML);
            }
          }}
        />

        {/* Bottom Hint */}
        <div
          className={`p-4 border-t border-gray-100 text-center text-xs text-gray-400 transition-opacity duration-300 ${
            isAnimating || isClosing ? 'opacity-0' : 'opacity-100'
          }`}
        >
          Type <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">/</span> for formatting options
        </div>

        <style>{`
          .note-content { outline: none; cursor: text; }
          .note-content h1 { font-size: 2.5em; font-weight: 700; margin-bottom: 0.3em; margin-top: 0; line-height: 1.1; color: #1a1a1a; }
          .note-content h2 { font-size: 1.8em; font-weight: 600; margin-bottom: 0.5em; margin-top: 0; line-height: 1.2; color: #2a2a2a; }
          .note-content h3 { font-size: 1.3em; font-weight: 600; margin-bottom: 0.5em; margin-top: 1em; line-height: 1.3; color: #3a3a3a; }
          .note-content ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
          .note-content ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
          .note-content li { margin-bottom: 0.5em; line-height: 1.6; color: #333; }
          .note-content p { margin-bottom: 1em; line-height: 1.7; color: #333; }
          .note-content pre { background: #1a1a1a; color: #e5e5e5; padding: 1em; border-radius: 8px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; overflow-x: auto; margin-bottom: 1em; }
          .note-content code { background: #f3f4f6; color: #1a1a1a; padding: 0.2em 0.4em; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
          .note-content pre code { background: transparent; color: inherit; padding: 0; }
          .note-content .task-item { display: flex; align-items: center; gap: 8px; margin-bottom: 0.5em; }
          .note-content .task-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; }
          .note-content:empty:before { content: 'Start typing...'; color: #9ca3af; pointer-events: none; display: block; }
          .note-content ::selection { background: #fef08a; }
        `}</style>
      </div>

      {/* Format Button (appears at cursor line) */}
      {formatButtonPosition && !showBlockMenu && !isAnimating && !isClosing && (
        <button
          className="fixed z-[120] w-7 h-7 flex items-center justify-center bg-gray-900/90 hover:bg-gray-800 rounded-lg shadow-lg border border-white/10 transition-all hover:scale-110"
          style={{ left: formatButtonPosition.x, top: formatButtonPosition.y }}
          onClick={handleFormatButtonClick}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
        >
          <Plus size={16} className="text-white/70" />
        </button>
      )}

      {/* Block Format Menu */}
      {showBlockMenu && (
        <div
          className="fixed z-[130] bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 py-2 min-w-[220px] animate-in fade-in zoom-in-95 duration-150"
          style={{ left: blockMenuPosition.x, top: blockMenuPosition.y }}
        >
          {blockOptions.map((option, index) => (
            <button
              key={option.id}
              onClick={() => selectBlockOption(option)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                index === selectedBlockIndex
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-white/50">{option.icon}</span>
              <span className="flex-1 font-medium">{option.label}</span>
              <span className="text-xs text-white/40 font-mono">{option.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
