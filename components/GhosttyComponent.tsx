import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { SpatialItem } from '../types';
import { Ghost, Maximize2, Minimize2, X, Terminal as TerminalIcon } from 'lucide-react';

interface Props {
  item: SpatialItem;
  onDoubleClick?: (rect: DOMRect) => void;
}

// Terminal theme matching Ghostty's default dark theme
const GHOSTTY_THEME = {
  background: '#1c1c1c',
  foreground: '#d8d8d8',
  cursor: '#d8d8d8',
  cursorAccent: '#1c1c1c',
  selectionBackground: '#444444',
  black: '#1c1c1c',
  red: '#ac4142',
  green: '#90a959',
  yellow: '#f4bf75',
  blue: '#6a9fb5',
  magenta: '#aa759f',
  cyan: '#75b5aa',
  white: '#d8d8d8',
  brightBlack: '#6b6b6b',
  brightRed: '#c55555',
  brightGreen: '#aac474',
  brightYellow: '#feca88',
  brightBlue: '#82b8c8',
  brightMagenta: '#c28cb8',
  brightCyan: '#93d3c3',
  brightWhite: '#f8f8f8',
};

export const GhosttyComponent: React.FC<Props> = memo(({ item, onDoubleClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Stop propagation for terminal interactions
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Initialize Ghostty terminal
  useEffect(() => {
    let mounted = true;
    let terminal: any = null;

    const initTerminal = async () => {
      try {
        // Dynamic import for ghostty-web
        const ghostty = await import('ghostty-web');
        await ghostty.init();

        if (!mounted || !terminalRef.current) return;

        // Create terminal instance
        terminal = new ghostty.Terminal({
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          theme: GHOSTTY_THEME,
          cursorBlink: true,
          cursorStyle: 'block',
          scrollback: 10000,
          tabStopWidth: 4,
        });

        // Open terminal in container
        terminal.open(terminalRef.current);
        termInstanceRef.current = terminal;
        setIsInitialized(true);

        // Write welcome message
        terminal.write('\x1b[1;36m👻 Ghostty Terminal\x1b[0m\r\n');
        terminal.write('\x1b[90m─────────────────────\x1b[0m\r\n');
        terminal.write('\r\n');

        // Try to connect to a local shell via WebSocket
        // This requires a backend PTY service
        tryConnectToShell(terminal);

      } catch (err: any) {
        console.error('Failed to initialize Ghostty:', err);
        if (mounted) {
          setError(err.message || 'Failed to initialize terminal');
        }
      }
    };

    const tryConnectToShell = (terminal: any) => {
      // Check if we have a PTY WebSocket server running
      // Default port for terminal PTY server
      const wsUrl = 'ws://localhost:3100';

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          terminal.write('\x1b[32mConnected to shell\x1b[0m\r\n\r\n');
        };

        ws.onmessage = (event) => {
          terminal.write(event.data);
        };

        ws.onerror = () => {
          // Silently fail - show local echo mode
          setIsConnected(false);
          terminal.write('\x1b[33mLocal mode (no shell connected)\x1b[0m\r\n');
          terminal.write('\x1b[90mType to echo locally. Connect a PTY server on ws://localhost:3100 for full shell.\x1b[0m\r\n\r\n');
          terminal.write('$ ');
        };

        ws.onclose = () => {
          setIsConnected(false);
        };

        // Send terminal input to shell
        terminal.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          } else {
            // Local echo mode
            if (data === '\r') {
              terminal.write('\r\n$ ');
            } else if (data === '\x7f') {
              // Backspace
              terminal.write('\b \b');
            } else {
              terminal.write(data);
            }
          }
        });

      } catch (err) {
        // No WebSocket server, use local echo mode
        setIsConnected(false);
        terminal.write('\x1b[33mLocal echo mode\x1b[0m\r\n$ ');

        terminal.onData((data: string) => {
          if (data === '\r') {
            terminal.write('\r\n$ ');
          } else if (data === '\x7f') {
            terminal.write('\b \b');
          } else {
            terminal.write(data);
          }
        });
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (terminal) {
        terminal.dispose?.();
      }
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (!termInstanceRef.current || !terminalRef.current) return;

    const resizeTerminal = () => {
      const term = termInstanceRef.current;
      const container = terminalRef.current;
      if (!term || !container) return;

      // Calculate rows and cols based on container size
      const cellWidth = 9; // Approximate character width
      const cellHeight = 17; // Approximate line height
      const padding = 16; // 8px padding on each side

      const cols = Math.floor((container.clientWidth - padding) / cellWidth);
      const rows = Math.floor((container.clientHeight - padding) / cellHeight);

      if (cols > 0 && rows > 0) {
        try {
          term.resize?.(cols, rows);
          // Send resize command to PTY server
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(`\x1b[RESIZE:${cols},${rows}]`);
          }
        } catch {
          // Ignore resize errors
        }
      }
    };

    const resizeObserver = new ResizeObserver(resizeTerminal);
    resizeObserver.observe(terminalRef.current);

    // Initial resize
    setTimeout(resizeTerminal, 100);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialized]);

  const handleDoubleClick = () => {
    if (containerRef.current && onDoubleClick) {
      onDoubleClick(containerRef.current.getBoundingClientRect());
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[#1c1c1c] overflow-hidden"
      onDoubleClick={handleDoubleClick}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between bg-[#2d2d2d] border-b border-[#3d3d3d] px-3 py-1.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <Ghost size={14} className="text-cyan-400" />
          <span className="text-xs font-medium text-gray-300">Ghostty</span>
          {isConnected && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
              connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onMouseDown={stopPropagation}
            onClick={(e) => {
              e.stopPropagation();
              setIsMaximized(!isMaximized);
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        className="flex-1 relative"
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      >
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c1c1c] text-gray-400 p-4">
            <TerminalIcon size={32} className="text-red-400 mb-3" />
            <p className="text-sm font-medium mb-1">Terminal Error</p>
            <p className="text-xs text-gray-500 text-center">{error}</p>
          </div>
        ) : !isInitialized ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c1c1c] text-gray-400">
            <Ghost size={32} className="text-cyan-400 mb-3 animate-pulse" />
            <p className="text-sm">Initializing Ghostty...</p>
          </div>
        ) : null}
        <div
          ref={terminalRef}
          className="w-full h-full"
          style={{
            opacity: isInitialized && !error ? 1 : 0,
            padding: '8px',
          }}
        />
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.item.w === next.item.w &&
         prev.item.h === next.item.h;
});
