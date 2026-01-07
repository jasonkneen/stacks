import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, StickyNote, Image, Video, Mic, Type, Layers, FileText } from 'lucide-react';
import { SpatialItem, Space } from '../types';

type FilterType = 'all' | 'note' | 'image' | 'video' | 'audio' | 'text' | 'folder';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  onSelectItem: (item: SpatialItem, spaceId: string) => void;
}

const filterConfig: { type: FilterType; icon: React.ReactNode; label: string }[] = [
  { type: 'all', icon: <Search size={16} />, label: 'All' },
  { type: 'note', icon: <StickyNote size={16} />, label: 'Notes' },
  { type: 'image', icon: <Image size={16} />, label: 'Images' },
  { type: 'video', icon: <Video size={16} />, label: 'Videos' },
  { type: 'audio', icon: <Mic size={16} />, label: 'Audio' },
  { type: 'text', icon: <Type size={16} />, label: 'Text' },
  { type: 'folder', icon: <Layers size={16} />, label: 'Stacks' },
];

export const SearchModal: React.FC<Props> = ({ isOpen, onClose, spaces, onSelectItem }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Collect all items from all spaces with their space info
  const allItems = useMemo(() => {
    const items: { item: SpatialItem; space: Space }[] = [];

    const collectItems = (space: Space) => {
      for (const item of space.items) {
        items.push({ item, space });
      }
    };

    spaces.forEach(collectItems);
    return items;
  }, [spaces]);

  // Filter items based on query and type filter
  const filteredItems = useMemo(() => {
    return allItems.filter(({ item }) => {
      // Type filter
      if (filter !== 'all' && item.type !== filter) return false;

      // Text search
      if (query.trim()) {
        const searchLower = query.toLowerCase();
        const content = (item.content || '').toLowerCase();
        const title = (item.metadata?.title as string || '').toLowerCase();
        const description = (item.metadata?.description as string || '').toLowerCase();
        const filename = (item.metadata?.filename as string || '').toLowerCase();

        return content.includes(searchLower) ||
               title.includes(searchLower) ||
               description.includes(searchLower) ||
               filename.includes(searchLower);
      }

      return true;
    }).slice(0, 20); // Limit results
  }, [allItems, query, filter]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setFilter('all');
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            const { item, space } = filteredItems[selectedIndex];
            onSelectItem(item, space.id);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onSelectItem, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'note': return <StickyNote size={18} className="text-yellow-500" />;
      case 'image': return <Image size={18} className="text-blue-500" />;
      case 'video': return <Video size={18} className="text-purple-500" />;
      case 'audio': return <Mic size={18} className="text-green-500" />;
      case 'text': return <Type size={18} className="text-gray-500" />;
      case 'folder': return <Layers size={18} className="text-orange-500" />;
      default: return <FileText size={18} className="text-gray-400" />;
    }
  };

  const getItemPreview = (item: SpatialItem) => {
    if (item.type === 'image' || item.type === 'video') {
      return item.metadata?.filename || item.metadata?.description || `${item.type} item`;
    }
    if (item.content && !item.content.startsWith('data:') && !item.content.startsWith('media_')) {
      return item.content.slice(0, 100) + (item.content.length > 100 ? '...' : '');
    }
    return item.metadata?.title || item.metadata?.description || `${item.type} item`;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden animate-modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/30">
          <Search size={22} className="text-gray-600 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items..."
            className="flex-1 bg-transparent text-gray-800 text-lg outline-none placeholder:text-gray-500"
          />
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-gray-600">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-gray-600">K</kbd>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 overflow-x-auto">
          {filterConfig.map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all whitespace-nowrap border ${
                filter === type
                  ? 'bg-gray-800 text-white border-gray-700'
                  : 'bg-white/40 backdrop-blur-sm text-gray-700 border-white/60 hover:bg-white/60 hover:text-gray-900'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {filteredItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-500">
              {query ? 'No items found' : 'Start typing to search...'}
            </div>
          ) : (
            filteredItems.map(({ item, space }, index) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectItem(item, space.id);
                  onClose();
                }}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-gray-800/80 text-white'
                    : 'hover:bg-white/30 text-gray-800'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  index === selectedIndex ? 'bg-white/20' : 'bg-white/50'
                }`}>
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${index === selectedIndex ? 'text-white' : 'text-gray-900'}`}>
                    {getItemPreview(item)}
                  </div>
                  <div className={`text-sm truncate ${index === selectedIndex ? 'text-gray-300' : 'text-gray-600'}`}>
                    in {space.name}
                  </div>
                </div>
                <div className={`text-xs ${index === selectedIndex ? 'text-gray-400' : 'text-gray-600'}`}>
                  {item.type}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {filteredItems.length > 0 && (
          <div className="px-5 py-2 border-t border-white/30 text-gray-600 text-xs flex items-center gap-4">
            <span><kbd className="px-1 bg-white/50 rounded text-gray-700">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 bg-white/50 rounded text-gray-700">↵</kbd> Select</span>
            <span><kbd className="px-1 bg-white/50 rounded text-gray-700">esc</kbd> Close</span>
          </div>
        )}
      </div>
    </div>
  );
};
