import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { SpatialItem } from '../types';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Plus,
  Globe,
  Lock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Home
} from 'lucide-react';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  active: boolean;
  loading?: boolean;
  favicon?: string;
}

interface Props {
  item: SpatialItem;
  onUpdateMetadata: (metadata: Partial<SpatialItem['metadata']>) => void;
  onDoubleClick?: (rect: DOMRect) => void;
}

// Generate unique tab ID
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Normalize URL - add protocol if missing
const normalizeUrl = (url: string): string => {
  if (!url) return 'about:blank';
  url = url.trim();

  // Handle search queries
  if (!url.includes('.') && !url.startsWith('http') && !url.startsWith('about:')) {
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
    return `https://${url}`;
  }

  return url;
};

// Check if URL is secure (HTTPS)
const isSecureUrl = (url: string): boolean => {
  return url.startsWith('https://') || url.startsWith('about:');
};

// Extract domain from URL
const getDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

export const BrowserComponent: React.FC<Props> = memo(({ item, onUpdateMetadata, onDoubleClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Initialize tabs from metadata or create default
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    if (item.metadata?.browserTabs && item.metadata.browserTabs.length > 0) {
      return item.metadata.browserTabs.map((t) => ({
        ...t,
        loading: false
      }));
    }
    return [{
      id: generateTabId(),
      url: item.metadata?.browserUrl || 'https://www.google.com',
      title: 'New Tab',
      active: true,
      loading: false
    }];
  });

  // History for navigation
  const [history, setHistory] = useState<string[]>(() =>
    item.metadata?.browserHistory || [tabs.find(t => t.active)?.url || 'https://www.google.com']
  );
  const [historyIndex, setHistoryIndex] = useState(() =>
    item.metadata?.browserHistoryIndex ?? 0
  );

  const [addressValue, setAddressValue] = useState(tabs.find(t => t.active)?.url || '');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Get active tab
  const activeTab = tabs.find(t => t.active) || tabs[0];

  // Can navigate back/forward
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // Sync tabs to metadata when they change
  useEffect(() => {
    onUpdateMetadata({
      browserTabs: tabs,
      browserUrl: activeTab?.url,
      browserHistory: history,
      browserHistoryIndex: historyIndex
    });
  }, [tabs, history, historyIndex, onUpdateMetadata, activeTab?.url]);

  // Update address bar when active tab changes
  useEffect(() => {
    if (activeTab && !isAddressFocused) {
      setAddressValue(activeTab.url);
    }
  }, [activeTab, isAddressFocused]);

  // Navigate to URL
  const navigate = useCallback((url: string, addToHistory = true) => {
    const normalizedUrl = normalizeUrl(url);
    setLoadError(null);

    // Update active tab
    setTabs(prev => prev.map(tab =>
      tab.active
        ? { ...tab, url: normalizedUrl, loading: true, title: 'Loading...' }
        : tab
    ));

    // Update history if needed
    if (addToHistory) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(normalizedUrl);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    }

    // Navigate iframe
    if (iframeRef.current) {
      iframeRef.current.src = normalizedUrl;
    }
  }, [historyIndex]);

  // Handle address bar submit
  const handleAddressSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    navigate(addressValue);
    addressInputRef.current?.blur();
  }, [addressValue, navigate]);

  // Go back in history
  const goBack = useCallback(() => {
    if (canGoBack) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex], false);
    }
  }, [canGoBack, history, historyIndex, navigate]);

  // Go forward in history
  const goForward = useCallback(() => {
    if (canGoForward) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex], false);
    }
  }, [canGoForward, history, historyIndex, navigate]);

  // Refresh current page
  const refresh = useCallback(() => {
    setTabs(prev => prev.map(tab =>
      tab.active ? { ...tab, loading: true } : tab
    ));

    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = 'about:blank';
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc;
      }, 50);
    }
  }, []);

  // Go to home
  const goHome = useCallback(() => {
    navigate('https://www.google.com');
  }, [navigate]);

  // Create new tab
  const createTab = useCallback(() => {
    const newTab: BrowserTab = {
      id: generateTabId(),
      url: 'https://www.google.com',
      title: 'New Tab',
      active: true,
      loading: false
    };

    setTabs(prev => [
      ...prev.map(t => ({ ...t, active: false })),
      newTab
    ]);

    // Reset history for new tab
    setHistory(['https://www.google.com']);
    setHistoryIndex(0);
  }, []);

  // Switch to tab
  const switchTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.active) {
      setTabs(prev => prev.map(t => ({ ...t, active: t.id === tabId })));

      // Navigate to tab's URL
      if (iframeRef.current && tab.url) {
        iframeRef.current.src = tab.url;
      }
    }
  }, [tabs]);

  // Close tab
  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setTabs(prev => {
      if (prev.length === 1) {
        // Can't close last tab, just reset it
        return [{
          id: generateTabId(),
          url: 'https://www.google.com',
          title: 'New Tab',
          active: true,
          loading: false
        }];
      }

      const closingActive = prev.find(t => t.id === tabId)?.active;
      const filtered = prev.filter(t => t.id !== tabId);

      // If closing active tab, activate the previous one
      if (closingActive && filtered.length > 0) {
        filtered[filtered.length - 1].active = true;
      }

      return filtered;
    });
  }, []);

  // Handle iframe load events (works in both Electron and browser)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setTabs(prev => prev.map(tab =>
        tab.active ? { ...tab, loading: false } : tab
      ));
      // Try to get title from iframe (may fail due to CORS)
      try {
        const title = iframe.contentDocument?.title;
        if (title) {
          setTabs(prev => prev.map(tab =>
            tab.active ? { ...tab, title } : tab
          ));
        }
      } catch {
        // CORS blocked, use domain as title
        setTabs(prev => prev.map(tab =>
          tab.active ? { ...tab, title: getDomain(tab.url) } : tab
        ));
      }
    };

    const handleError = () => {
      setLoadError('Failed to load page');
      setTabs(prev => prev.map(tab =>
        tab.active ? { ...tab, loading: false } : tab
      ));
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, []);

  const handleDoubleClick = () => {
    if (containerRef.current && onDoubleClick) {
      onDoubleClick(containerRef.current.getBoundingClientRect());
    }
  };

  // Stop mouse events from bubbling to prevent canvas drag (but allow on tab bar for dragging)
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-gray-900 overflow-hidden"
      onDoubleClick={handleDoubleClick}
    >
      {/* Tab Bar - allows dragging the browser item from here */}
      <div className="flex items-center bg-gray-800 border-b border-gray-700 min-h-[36px] px-1 cursor-grab active:cursor-grabbing">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onMouseDown={stopPropagation}
              onClick={() => switchTab(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px]
                rounded-t-lg cursor-pointer transition-colors group
                ${tab.active
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                }
              `}
            >
              {tab.loading ? (
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
              ) : (
                <Globe size={12} className="flex-shrink-0 text-gray-500" />
              )}
              <span className="truncate text-xs flex-1">{tab.title}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded p-0.5 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          onMouseDown={stopPropagation}
          onClick={createTab}
          className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Navigation Bar - stop propagation to prevent drag */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border-b border-gray-700"
        onMouseDown={stopPropagation}
      >
        {/* Navigation Buttons */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`p-1.5 rounded transition-colors ${
            canGoBack
              ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`p-1.5 rounded transition-colors ${
            canGoForward
              ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <ArrowRight size={16} />
        </button>
        <button
          onClick={refresh}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          {activeTab?.loading ? (
            <X size={16} />
          ) : (
            <RotateCw size={16} />
          )}
        </button>
        <button
          onClick={goHome}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          <Home size={16} />
        </button>

        {/* Address Bar */}
        <form onSubmit={handleAddressSubmit} className="flex-1">
          <div className="relative flex items-center">
            <div className="absolute left-2 text-gray-500">
              {isSecureUrl(activeTab?.url || '') ? (
                <Lock size={12} className="text-green-500" />
              ) : activeTab?.url?.startsWith('http://') ? (
                <AlertTriangle size={12} className="text-yellow-500" />
              ) : (
                <Globe size={12} />
              )}
            </div>
            <input
              ref={addressInputRef}
              type="text"
              value={addressValue}
              onChange={(e) => setAddressValue(e.target.value)}
              onFocus={() => {
                setIsAddressFocused(true);
                addressInputRef.current?.select();
              }}
              onBlur={() => setIsAddressFocused(false)}
              placeholder="Search or enter URL"
              className="w-full bg-gray-700 text-gray-200 text-sm rounded-md py-1.5 pl-7 pr-8
                focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500
                border border-gray-600 focus:border-blue-500"
            />
            {activeTab?.loading && (
              <div className="absolute right-2">
                <Loader2 size={12} className="animate-spin text-blue-400" />
              </div>
            )}
          </div>
        </form>

        {/* External Link Button */}
        <button
          onClick={() => {
            if (activeTab?.url) {
              window.open(activeTab.url, '_blank');
            }
          }}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          title="Open in external browser"
        >
          <ExternalLink size={16} />
        </button>
      </div>

      {/* WebView Content - stop propagation to prevent drag */}
      <div
        className="flex-1 relative bg-white"
        onMouseDown={stopPropagation}
      >
        {loadError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400">
            <AlertTriangle size={48} className="text-yellow-500 mb-4" />
            <p className="text-lg font-medium mb-2">Failed to load page</p>
            <p className="text-sm text-gray-500 mb-4">{loadError}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={activeTab?.url || 'about:blank'}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
            title="Browser"
          />
        )}

        {/* Loading Bar */}
        {activeTab?.loading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-700">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.item.content === next.item.content &&
         prev.item.metadata?.browserUrl === next.item.metadata?.browserUrl;
});
