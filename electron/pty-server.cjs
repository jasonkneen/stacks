const WebSocket = require('ws');
const os = require('os');
const pty = require('node-pty');

const PTY_PORT = 3100;

let wss = null;
const terminals = new Map();

function getShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

function startPtyServer() {
  if (wss) {
    console.log('[PTY] Server already running');
    return;
  }

  wss = new WebSocket.Server({ port: PTY_PORT });
  console.log(`[PTY] WebSocket server started on ws://localhost:${PTY_PORT}`);

  wss.on('connection', (ws) => {
    console.log('[PTY] Client connected');

    // Spawn a new PTY process
    const shell = getShell();
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    const terminalId = ptyProcess.pid.toString();
    terminals.set(terminalId, { pty: ptyProcess, ws });

    console.log(`[PTY] Spawned ${shell} with PID ${ptyProcess.pid}`);

    // Send PTY output to WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] Process ${ptyProcess.pid} exited with code ${exitCode}, signal ${signal}`);
      terminals.delete(terminalId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Receive input from WebSocket
    ws.on('message', (message) => {
      const data = message.toString();

      // Check for resize command
      if (data.startsWith('\x1b[RESIZE:')) {
        const match = data.match(/\x1b\[RESIZE:(\d+),(\d+)\]/);
        if (match) {
          const cols = parseInt(match[1], 10);
          const rows = parseInt(match[2], 10);
          ptyProcess.resize(cols, rows);
          console.log(`[PTY] Resized to ${cols}x${rows}`);
        }
        return;
      }

      ptyProcess.write(data);
    });

    ws.on('close', () => {
      console.log(`[PTY] Client disconnected, killing PID ${ptyProcess.pid}`);
      ptyProcess.kill();
      terminals.delete(terminalId);
    });

    ws.on('error', (err) => {
      console.error('[PTY] WebSocket error:', err.message);
      ptyProcess.kill();
      terminals.delete(terminalId);
    });
  });

  wss.on('error', (err) => {
    console.error('[PTY] Server error:', err.message);
  });
}

function stopPtyServer() {
  if (!wss) return;

  // Kill all terminal processes
  terminals.forEach(({ pty }) => {
    try {
      pty.kill();
    } catch (e) {
      // Ignore
    }
  });
  terminals.clear();

  // Close WebSocket server
  wss.close(() => {
    console.log('[PTY] Server stopped');
  });
  wss = null;
}

module.exports = { startPtyServer, stopPtyServer };
