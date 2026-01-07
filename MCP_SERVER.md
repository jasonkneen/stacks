# Stacks MCP Integration

This project includes both MCP **server** (exposing the canvas to AI) and MCP **client** (consuming external MCP servers) capabilities.

---

## Part 1: MCP Server (Exposing Canvas to AI)

The MCP server exposes the Stacks canvas to AI assistants like Claude, allowing them to create, modify, and organize items on your canvas programmatically.

## Setup

### 1. Build the Server

```bash
npm run mcp:build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stacks-canvas": {
      "command": "node",
      "args": ["/path/to/stacks/dist/mcp/server.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

Quit Claude Desktop completely (Cmd+Q) and reopen it.

## Available Tools

### Item Operations

| Tool | Description |
|------|-------------|
| `add_item` | Create a sticky note, note, image, video, or folder |
| `update_item` | Modify position, size, content, or style of an item |
| `delete_item` | Remove an item from a space |
| `move_item` | Reposition an item (convenience method) |

### Connection Operations

| Tool | Description |
|------|-------------|
| `create_connection` | Link two items with a visual connection |
| `delete_connection` | Remove a connection |

### Space Operations

| Tool | Description |
|------|-------------|
| `list_spaces` | Show all available spaces |
| `get_space` | Get detailed info about a space |
| `create_space` | Create a new top-level space |
| `delete_space` | Delete a space and its contents |
| `list_items` | List all items in a space |

### Bulk Operations

| Tool | Description |
|------|-------------|
| `organize_items` | Auto-layout items in a grid |
| `clear_space` | Remove all items from a space |

## Example Usage

Ask Claude:

- "Add 5 sticky notes with project ideas to my canvas"
- "Organize the items in root space into 3 columns"
- "Create connections between related notes"
- "Clear all items from the root space"
- "List all my spaces and their contents"

## Prompts

The server includes AI workflow prompts:

| Prompt | Description |
|--------|-------------|
| `brainstorm` | Generate ideas as sticky notes |
| `summarize_space` | Analyze and summarize canvas contents |
| `layout_suggestions` | Get organization recommendations |

## Resources

| Resource URI | Description |
|-------------|-------------|
| `canvas://spaces` | JSON list of all spaces |

## Data Storage

Canvas data is persisted in SQLite at:
```
~/.stacks/canvas.db
```

## Development

Run in development mode with auto-reload:
```bash
npm run mcp:dev
```

Test with MCP Inspector:
```bash
npx @modelcontextprotocol/inspector node dist/mcp/server.js
```

## Item Types

| Type | Dimensions | Default Color |
|------|-----------|---------------|
| `sticky` | 200x200 | bg-yellow-200 |
| `note` | 300x400 | - |
| `image` | 300x200 | - |
| `video` | 300x200 | - |
| `folder` | 200x240 | - |

## Coordinates

- Canvas uses infinite 2D coordinates
- (0, 0) is center
- Positive X = right, positive Y = down
- Typical spacing: 300-400 pixels between items

---

## Part 2: MCP Client (Consuming External Servers)

The app can connect to external MCP servers via a WebSocket proxy, extending AI capabilities with external tools.

### Architecture

```
Browser App  <-->  MCP Proxy (ws://localhost:3099)  <-->  stdio MCP Servers
```

### Setup

1. **Start the proxy server:**
   ```bash
   npm run mcp:proxy
   ```

2. **Start the app:**
   ```bash
   npm run dev
   ```

3. **Configure servers in Settings > MCP Servers**

### Adding MCP Servers

In the Settings modal, click "Add MCP Server" and provide:

- **Server ID**: Unique identifier (e.g., `filesystem`)
- **Command**: The executable (e.g., `npx`)
- **Arguments**: Space-separated args (e.g., `-y @anthropic/mcp-server-filesystem /Users`)

### Example Servers

**Filesystem access:**
```
ID: filesystem
Command: npx
Args: -y @anthropic/mcp-server-filesystem /Users/yourname/Documents
```

**Brave Search:**
```
ID: brave-search
Command: npx
Args: -y @anthropic/mcp-server-brave-search
Env: BRAVE_API_KEY=your-key
```

**GitHub:**
```
ID: github
Command: npx
Args: -y @anthropic/mcp-server-github
Env: GITHUB_TOKEN=your-token
```

### Using MCP Tools

Once connected, MCP tools are available to the AI generation features. The `useMCPClient` hook provides:

```typescript
import { useMCPClient } from './hooks/useMCPClient';

const mcp = useMCPClient();

// List all available tools
console.log(mcp.tools);

// Call a tool
const result = await mcp.callTool('filesystem', 'read_file', { path: '/etc/hosts' });

// Read a resource
const data = await mcp.readResource('filesystem', 'file:///path/to/file');
```

### Proxy Configuration

The proxy stores its config at `~/.stacks/mcp-proxy-config.json`:

```json
{
  "port": 3099,
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/Users"],
      "enabled": true
    }
  }
}
```

### Troubleshooting

**Proxy not connecting:**
- Ensure proxy is running: `npm run mcp:proxy`
- Check port 3099 is available

**Server not starting:**
- Check the command path is correct
- View proxy stderr for error messages
- Ensure required environment variables are set
