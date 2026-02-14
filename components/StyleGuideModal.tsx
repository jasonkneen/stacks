import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Palette, Box, MousePointer, Layout, Layers, Maximize2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type StyleCategory = 'modals' | 'buttons' | 'inputs' | 'toolbars' | 'pills' | 'cards';

const categories: { id: StyleCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'modals', label: 'Modals', icon: <Maximize2 size={16} /> },
  { id: 'buttons', label: 'Buttons', icon: <MousePointer size={16} /> },
  { id: 'inputs', label: 'Inputs', icon: <Box size={16} /> },
  { id: 'toolbars', label: 'Toolbars', icon: <Layout size={16} /> },
  { id: 'pills', label: 'Pills/Chips', icon: <Layers size={16} /> },
  { id: 'cards', label: 'Cards', icon: <Palette size={16} /> },
];

const styleExamples: Record<StyleCategory, { name: string; classes: string; description: string }[]> = {
  modals: [
    {
      name: 'Light Glass Modal Container',
      classes: 'bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60',
      description: 'Primary modal container with frosted glass effect',
    },
    {
      name: 'Modal Backdrop',
      classes: 'bg-black/50 backdrop-blur-sm',
      description: 'Semi-transparent dark backdrop for modals',
    },
    {
      name: 'Large Settings Modal',
      classes: 'bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl shadow-2xl max-w-3xl',
      description: 'Large modal with tabs for settings panels',
    },
  ],
  buttons: [
    {
      name: 'Primary Glass Button',
      classes: 'px-5 py-2.5 bg-white/40 backdrop-blur-md rounded-full shadow-lg border border-white/60 font-semibold text-sm text-gray-800 hover:bg-white/50 transition-colors',
      description: 'Main action button with glass effect',
    },
    {
      name: 'Icon Button (Circular)',
      classes: 'w-6 h-6 rounded-full bg-white/40 backdrop-blur-md border border-white/60 hover:bg-white/50 transition-all cursor-pointer shadow-lg hover:scale-110 flex items-center justify-center',
      description: 'Small circular icon button with scale hover effect',
    },
    {
      name: 'Dark Glass Button',
      classes: 'p-3 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95',
      description: 'Button for dark backgrounds (toolbar)',
    },
    {
      name: 'Add Button (FAB)',
      classes: 'bg-gray-900 text-white p-3.5 rounded-full hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95',
      description: 'Floating action button for primary actions',
    },
    {
      name: 'Disabled Button',
      classes: 'opacity-50 cursor-not-allowed pointer-events-none',
      description: 'Disabled state for buttons',
    },
  ],
  inputs: [
    {
      name: 'Glass Input',
      classes: 'w-full px-3 py-2 bg-white/60 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900',
      description: 'Text input with glass border effect',
    },
    {
      name: 'Search Input',
      classes: 'flex-1 bg-transparent text-gray-800 text-lg outline-none placeholder:text-gray-500',
      description: 'Clean input for search fields',
    },
    {
      name: 'Kbd Shortcut Display',
      classes: 'px-1.5 py-0.5 bg-white/50 rounded text-gray-600',
      description: 'Keyboard shortcut indicator',
    },
  ],
  toolbars: [
    {
      name: 'Dark Glass Toolbar',
      classes: 'bg-gray-900/95 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/10',
      description: 'Bottom-centered toolbar for dark themes',
    },
    {
      name: 'Dark Glass Dropdown',
      classes: 'bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-2 flex flex-col gap-1',
      description: 'Dropdown menu with dark glass effect',
    },
    {
      name: 'Space Indicator Container',
      classes: 'bg-gray-900/95 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-xl border border-white/10',
      description: 'Container for space switching pills',
    },
  ],
  pills: [
    {
      name: 'Glass Pill (Inactive)',
      classes: 'bg-white/40 backdrop-blur-sm text-gray-700 border-white/60 hover:bg-white/60 hover:text-gray-900',
      description: 'Inactive filter pill or chip',
    },
    {
      name: 'Glass Pill (Active)',
      classes: 'bg-gray-800 text-white border-gray-700',
      description: 'Active filter pill or chip',
    },
    {
      name: 'Small Pill',
      classes: 'px-2 py-0.5 bg-white/50 rounded text-xs',
      description: 'Small status indicator pill',
    },
  ],
  cards: [
    {
      name: 'Glass Card',
      classes: 'bg-white/40 backdrop-blur-md rounded-xl border border-white/60 shadow-lg',
      description: 'Content card with glass effect',
    },
    {
      name: 'Selected Item Background',
      classes: 'bg-gray-800/80 text-white',
      description: 'Selected list item highlight',
    },
    {
      name: 'Hover Item Background',
      classes: 'hover:bg-white/30 text-gray-800',
      description: 'Hover state for list items',
    },
  ],
};

export const StyleGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<StyleCategory>('modals');
  const [copiedClass, setCopiedClass] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap and escape handling
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const copyToClipboard = (classes: string) => {
    navigator.clipboard.writeText(classes);
    setCopiedClass(classes);
    setTimeout(() => setCopiedClass(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl max-h-[85vh] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden flex flex-col animate-modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <div className="flex items-center gap-3">
            <Palette size={22} className="text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Glass Style Guide</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-500 text-xs mr-2">
              <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-gray-600">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-gray-600">⇧</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-gray-600">G</kbd>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/40 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/30 overflow-x-auto">
          {categories.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all whitespace-nowrap border ${
                activeCategory === id
                  ? 'bg-gray-800 text-white border-gray-700'
                  : 'bg-white/40 backdrop-blur-sm text-gray-700 border-white/60 hover:bg-white/60 hover:text-gray-900'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6">
            {styleExamples[activeCategory].map((example, index) => (
              <div
                key={index}
                className="bg-white/30 backdrop-blur-sm rounded-xl border border-white/40 overflow-hidden"
              >
                {/* Example Preview */}
                <div className="p-6 bg-gradient-to-br from-gray-50/50 to-gray-100/50 border-b border-white/40">
                  <div className="flex items-center justify-center min-h-[80px]">
                    {activeCategory === 'modals' && index === 0 && (
                      <div className={example.classes + ' w-64 h-32 flex items-center justify-center text-sm text-gray-600'}>
                        Modal Content
                      </div>
                    )}
                    {activeCategory === 'modals' && index === 1 && (
                      <div className={example.classes + ' w-64 h-32 flex items-center justify-center text-sm text-white'}>
                        Backdrop Area
                      </div>
                    )}
                    {activeCategory === 'modals' && index === 2 && (
                      <div className={example.classes + ' w-80 h-40 flex items-center justify-center text-sm text-gray-600'}>
                        Settings Modal
                      </div>
                    )}
                    {activeCategory === 'buttons' && index === 0 && (
                      <button className={example.classes}>
                        Primary Action
                      </button>
                    )}
                    {activeCategory === 'buttons' && index === 1 && (
                      <div className="flex gap-2">
                        <button className={example.classes}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {activeCategory === 'buttons' && index === 2 && (
                      <div className="bg-gray-800 p-4 rounded-lg">
                        <button className={example.classes}>
                          <span>Action</span>
                        </button>
                      </div>
                    )}
                    {activeCategory === 'buttons' && index === 3 && (
                      <button className={example.classes}>
                        <span>+</span>
                      </button>
                    )}
                    {activeCategory === 'buttons' && index === 4 && (
                      <button className={`px-5 py-2.5 bg-white/40 backdrop-blur-md rounded-full shadow-lg border border-white/60 font-semibold text-sm text-gray-800 ${example.classes}`} disabled>
                        Disabled
                      </button>
                    )}
                    {activeCategory === 'inputs' && (
                      <>
                        {index === 0 && (
                          <input
                            type="text"
                            placeholder="Enter text..."
                            className={example.classes}
                          />
                        )}
                        {index === 1 && (
                          <input
                            type="text"
                            placeholder="Search..."
                            className={example.classes}
                          />
                        )}
                        {index === 2 && (
                          <div className="flex items-center gap-2">
                            <kbd className={example.classes}>⌘</kbd>
                            <kbd className={example.classes}>K</kbd>
                          </div>
                        )}
                      </>
                    )}
                    {activeCategory === 'toolbars' && index === 0 && (
                      <div className={example.classes + ' flex gap-1'}>
                        <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        </button>
                        <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {activeCategory === 'toolbars' && index === 1 && (
                      <div className={example.classes + ' w-40'}>
                        <button className="p-2 text-white hover:bg-white/10 rounded-lg w-full text-left text-sm">Option 1</button>
                        <button className="p-2 text-white hover:bg-white/10 rounded-lg w-full text-left text-sm">Option 2</button>
                      </div>
                    )}
                    {activeCategory === 'toolbars' && index === 2 && (
                      <div className={example.classes}>
                        <span className="text-white text-xs">Space: Main</span>
                      </div>
                    )}
                    {activeCategory === 'pills' && (
                      <>
                        {index === 0 && (
                          <span className={example.classes}>
                            Inactive
                          </span>
                        )}
                        {index === 1 && (
                          <span className={example.classes}>
                            Active
                          </span>
                        )}
                        {index === 2 && (
                          <span className={example.classes}>
                            Status
                          </span>
                        )}
                      </>
                    )}
                    {activeCategory === 'cards' && (
                      <>
                        {index === 0 && (
                          <div className={example.classes + ' p-4 w-48'}>
                            <div className="text-sm text-gray-700">Card Content</div>
                          </div>
                        )}
                        {index === 1 && (
                          <div className={example.classes + ' px-4 py-3 w-48'}>
                            <div className="text-sm">Selected Item</div>
                          </div>
                        )}
                        {index === 2 && (
                          <div className={example.classes + ' px-4 py-3 w-48 cursor-pointer'}>
                            <div className="text-sm">Hover Item</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {example.name}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {example.description}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(example.classes)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-white/40 rounded-lg transition-colors flex-shrink-0"
                      title="Copy classes"
                    >
                      {copiedClass === example.classes ? (
                        <>
                          <Check size={14} className="text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-3 p-2 bg-gray-900/5 rounded-lg border border-gray-200/50">
                    <code className="text-xs text-gray-700 break-all">
                      {example.classes}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/30 text-gray-600 text-xs flex items-center justify-between">
          <span>Glass UI Patterns Reference</span>
          <div className="flex items-center gap-2">
            <span><kbd className="px-1 bg-white/50 rounded text-gray-700">esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
