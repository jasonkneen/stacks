#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Types (mirror from ../types.ts for standalone operation)
type ItemType = 'sticky' | 'note' | 'image' | 'video' | 'folder';

interface SpatialItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  rotation: number;
  content: string;
  color?: string;
  metadata?: Record<string, unknown>;
  linkedSpaceId?: string;
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

interface Space {
  id: string;
  name: string;
  parentId: string | null;
  items: SpatialItem[];
  connections: Connection[];
  camera: { x: number; y: number; zoom: number };
}

const newDataDir = join(homedir(), ".stacks");
const legacyDataDir = join(homedir(), ".spatial");
const legacyDbPath = join(legacyDataDir, "canvas.db");
const newDbPath = join(newDataDir, "canvas.db");

if (!existsSync(newDataDir)) {
  mkdirSync(newDataDir, { recursive: true });
}

if (existsSync(legacyDbPath) && !existsSync(newDbPath)) {
  copyFileSync(legacyDbPath, newDbPath);
  console.error("Migrated database from ~/.spatial to ~/.stacks");
}

const dataDir = newDataDir;
const db = new Database(newDbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    data JSON NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Database helpers
const loadSpace = (spaceId: string): Space | null => {
  const row = db.prepare("SELECT data FROM spaces WHERE id = ?").get(spaceId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
};

const saveSpace = (space: Space): void => {
  db.prepare("INSERT OR REPLACE INTO spaces (id, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .run(space.id, JSON.stringify(space));
};

const listSpaces = (): Space[] => {
  const rows = db.prepare("SELECT data FROM spaces").all() as { data: string }[];
  return rows.map(row => JSON.parse(row.data));
};

const deleteSpace = (spaceId: string): boolean => {
  const result = db.prepare("DELETE FROM spaces WHERE id = ?").run(spaceId);
  return result.changes > 0;
};

// Ensure root space exists
if (!loadSpace("root")) {
  saveSpace({
    id: "root",
    name: "Scratchpad",
    parentId: null,
    items: [],
    connections: [],
    camera: { x: 0, y: 0, zoom: 1 }
  });
}

// Item defaults
const ITEM_DEFAULTS: Record<ItemType, { w: number; h: number; color?: string }> = {
  sticky: { w: 200, h: 200, color: "bg-yellow-200" },
  note: { w: 300, h: 400 },
  image: { w: 300, h: 200 },
  video: { w: 300, h: 200 },
  folder: { w: 200, h: 240 }
};

// Generate unique ID
const generateId = (prefix: string = "item"): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Create MCP Server
const server = new McpServer({
  name: "stacks-canvas",
  version: "1.0.0",
});

// ============================================
// TOOLS: Canvas Item Operations
// ============================================

server.tool(
  "add_item",
  "Add a new item (sticky note, note, image, video, or folder) to a space",
  {
    spaceId: z.string().describe("ID of the space to add item to (use 'root' for main space)"),
    itemType: z.enum(["sticky", "note", "image", "video", "folder"]).describe("Type of item to create"),
    x: z.number().describe("X coordinate on canvas"),
    y: z.number().describe("Y coordinate on canvas"),
    content: z.string().describe("Item content: text for sticky/note, URL for image/video, name for folder"),
    width: z.number().optional().describe("Width (optional, uses default based on type)"),
    height: z.number().optional().describe("Height (optional, uses default based on type)"),
    rotation: z.number().optional().describe("Rotation in degrees (optional, default 0)"),
    color: z.string().optional().describe("Tailwind color class e.g. 'bg-yellow-200' (optional)"),
  },
  async ({ spaceId, itemType, x, y, content, width, height, rotation, color }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space "${spaceId}" not found` }] };
    }

    const defaults = ITEM_DEFAULTS[itemType as ItemType];
    const maxZ = space.items.length > 0 ? Math.max(...space.items.map(i => i.zIndex)) : 0;

    const newItem: SpatialItem = {
      id: generateId(itemType),
      type: itemType as ItemType,
      x: x ?? 0,
      y: y ?? 0,
      w: width ?? defaults.w,
      h: height ?? defaults.h,
      zIndex: maxZ + 1,
      rotation: rotation ?? (Math.random() - 0.5) * 6,
      content,
      color: color ?? defaults.color,
    };

    // If folder, create linked space
    if (itemType === "folder") {
      const linkedSpaceId = generateId("space");
      newItem.linkedSpaceId = linkedSpaceId;
      saveSpace({
        id: linkedSpaceId,
        name: content,
        parentId: spaceId,
        items: [],
        connections: [],
        camera: { x: 0, y: 0, zoom: 1 }
      });
    }

    space.items.push(newItem);
    saveSpace(space);

    return {
      content: [{
        type: "text" as const,
        text: `Created ${itemType} "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}" at (${x}, ${y}) with ID: ${newItem.id}`
      }]
    };
  }
);

server.tool(
  "update_item",
  "Update an existing item's position, size, content, or properties",
  {
    spaceId: z.string().describe("Space ID containing the item"),
    itemId: z.string().describe("ID of item to update"),
    x: z.number().optional().describe("New X position"),
    y: z.number().optional().describe("New Y position"),
    w: z.number().optional().describe("New width"),
    h: z.number().optional().describe("New height"),
    rotation: z.number().optional().describe("New rotation"),
    content: z.string().optional().describe("New content"),
    color: z.string().optional().describe("New color"),
    zIndex: z.number().optional().describe("New z-index/layer"),
  },
  async ({ spaceId, itemId, ...updates }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space "${spaceId}" not found` }] };
    }

    const item = space.items.find(i => i.id === itemId);
    if (!item) {
      return { content: [{ type: "text" as const, text: `Error: Item "${itemId}" not found` }] };
    }

    // Apply updates
    const validUpdates = Object.entries(updates).filter(([_, v]) => v !== undefined);
    for (const [key, value] of validUpdates) {
      (item as any)[key] = value;
    }

    saveSpace(space);

    return {
      content: [{
        type: "text" as const,
        text: `Updated item ${itemId}: ${validUpdates.map(([k, v]) => `${k}=${v}`).join(", ")}`
      }]
    };
  }
);

server.tool(
  "delete_item",
  "Delete an item from a space",
  {
    spaceId: z.string().describe("Space ID"),
    itemId: z.string().describe("Item ID to delete"),
  },
  async ({ spaceId, itemId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space "${spaceId}" not found` }] };
    }

    const index = space.items.findIndex(i => i.id === itemId);
    if (index === -1) {
      return { content: [{ type: "text" as const, text: `Error: Item "${itemId}" not found` }] };
    }

    const deleted = space.items.splice(index, 1)[0];

    // Also remove any connections involving this item
    space.connections = space.connections.filter(c => c.from !== itemId && c.to !== itemId);

    // If folder, delete linked space
    if (deleted.linkedSpaceId) {
      deleteSpace(deleted.linkedSpaceId);
    }

    saveSpace(space);

    return {
      content: [{ type: "text" as const, text: `Deleted ${deleted.type} "${deleted.content.substring(0, 30)}..."` }]
    };
  }
);

server.tool(
  "move_item",
  "Move an item to a new position (convenience method)",
  {
    spaceId: z.string().describe("Space ID"),
    itemId: z.string().describe("Item ID"),
    x: z.number().describe("New X position"),
    y: z.number().describe("New Y position"),
  },
  async ({ spaceId, itemId, x, y }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    const item = space.items.find(i => i.id === itemId);
    if (!item) {
      return { content: [{ type: "text" as const, text: `Error: Item not found` }] };
    }

    const oldPos = { x: item.x, y: item.y };
    item.x = x;
    item.y = y;
    saveSpace(space);

    return {
      content: [{ type: "text" as const, text: `Moved item from (${oldPos.x}, ${oldPos.y}) to (${x}, ${y})` }]
    };
  }
);

// ============================================
// TOOLS: Connection Operations
// ============================================

server.tool(
  "create_connection",
  "Create a visual connection/link between two items",
  {
    spaceId: z.string().describe("Space ID"),
    fromItemId: z.string().describe("Source item ID"),
    toItemId: z.string().describe("Target item ID"),
  },
  async ({ spaceId, fromItemId, toItemId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    // Verify both items exist
    const fromItem = space.items.find(i => i.id === fromItemId);
    const toItem = space.items.find(i => i.id === toItemId);

    if (!fromItem || !toItem) {
      return { content: [{ type: "text" as const, text: `Error: One or both items not found` }] };
    }

    // Check for duplicate
    const exists = space.connections.some(
      c => (c.from === fromItemId && c.to === toItemId) || (c.from === toItemId && c.to === fromItemId)
    );

    if (exists) {
      return { content: [{ type: "text" as const, text: `Connection already exists between these items` }] };
    }

    const connection: Connection = {
      id: generateId("conn"),
      from: fromItemId,
      to: toItemId,
    };

    space.connections.push(connection);
    saveSpace(space);

    return {
      content: [{ type: "text" as const, text: `Created connection: ${fromItem.content.substring(0, 20)} -> ${toItem.content.substring(0, 20)}` }]
    };
  }
);

server.tool(
  "delete_connection",
  "Delete a connection between items",
  {
    spaceId: z.string().describe("Space ID"),
    connectionId: z.string().describe("Connection ID to delete"),
  },
  async ({ spaceId, connectionId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    const index = space.connections.findIndex(c => c.id === connectionId);
    if (index === -1) {
      return { content: [{ type: "text" as const, text: `Error: Connection not found` }] };
    }

    space.connections.splice(index, 1);
    saveSpace(space);

    return { content: [{ type: "text" as const, text: `Deleted connection ${connectionId}` }] };
  }
);

// ============================================
// TOOLS: Space Management
// ============================================

server.tool(
  "list_spaces",
  "List all available spaces",
  {},
  async () => {
    const spaces = listSpaces();
    const summary = spaces.map(s =>
      `- ${s.name} (${s.id}): ${s.items.length} items, ${s.connections.length} connections`
    ).join("\n");

    return {
      content: [{
        type: "text" as const,
        text: `Found ${spaces.length} spaces:\n${summary}`
      }]
    };
  }
);

server.tool(
  "get_space",
  "Get detailed information about a specific space",
  {
    spaceId: z.string().describe("Space ID to retrieve"),
  },
  async ({ spaceId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space "${spaceId}" not found` }] };
    }

    const itemSummary = space.items.map(i =>
      `  - [${i.type}] "${i.content.substring(0, 40)}${i.content.length > 40 ? '...' : ''}" at (${Math.round(i.x)}, ${Math.round(i.y)}) ID: ${i.id}`
    ).join("\n");

    const connSummary = space.connections.map(c =>
      `  - ${c.from} -> ${c.to}`
    ).join("\n");

    return {
      content: [{
        type: "text" as const,
        text: `Space: ${space.name} (${space.id})
Parent: ${space.parentId || "none (root level)"}
Camera: x=${space.camera.x}, y=${space.camera.y}, zoom=${space.camera.zoom}

Items (${space.items.length}):
${itemSummary || "  (none)"}

Connections (${space.connections.length}):
${connSummary || "  (none)"}`
      }]
    };
  }
);

server.tool(
  "create_space",
  "Create a new top-level space",
  {
    name: z.string().describe("Name for the new space"),
  },
  async ({ name }) => {
    const newSpace: Space = {
      id: generateId("space"),
      name,
      parentId: null,
      items: [],
      connections: [],
      camera: { x: 0, y: 0, zoom: 1 }
    };

    saveSpace(newSpace);

    return {
      content: [{ type: "text" as const, text: `Created new space "${name}" with ID: ${newSpace.id}` }]
    };
  }
);

server.tool(
  "delete_space",
  "Delete a space and all its contents (cannot delete root)",
  {
    spaceId: z.string().describe("Space ID to delete"),
  },
  async ({ spaceId }) => {
    if (spaceId === "root") {
      return { content: [{ type: "text" as const, text: `Error: Cannot delete root space` }] };
    }

    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    // Delete any linked sub-spaces from folders
    for (const item of space.items) {
      if (item.linkedSpaceId) {
        deleteSpace(item.linkedSpaceId);
      }
    }

    deleteSpace(spaceId);

    return {
      content: [{ type: "text" as const, text: `Deleted space "${space.name}" and ${space.items.length} items` }]
    };
  }
);

server.tool(
  "list_items",
  "List all items in a space with their positions and types",
  {
    spaceId: z.string().describe("Space ID"),
  },
  async ({ spaceId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    if (space.items.length === 0) {
      return { content: [{ type: "text" as const, text: `Space "${space.name}" is empty` }] };
    }

    const summary = space.items.map(i => {
      const preview = i.content.substring(0, 50) + (i.content.length > 50 ? "..." : "");
      return `- ${i.type} "${preview}" at (${Math.round(i.x)}, ${Math.round(i.y)}) [${i.id}]`;
    }).join("\n");

    return {
      content: [{
        type: "text" as const,
        text: `Items in "${space.name}" (${space.items.length}):\n${summary}`
      }]
    };
  }
);

// ============================================
// TOOLS: Bulk Operations
// ============================================

server.tool(
  "organize_items",
  "Auto-organize items in a grid layout",
  {
    spaceId: z.string().describe("Space ID"),
    columns: z.number().optional().default(3).describe("Number of columns (default 3)"),
    spacing: z.number().optional().default(40).describe("Spacing between items (default 40)"),
  },
  async ({ spaceId, columns = 3, spacing = 40 }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    if (space.items.length === 0) {
      return { content: [{ type: "text" as const, text: `No items to organize` }] };
    }

    // Sort by current position for stability
    const sorted = [...space.items].sort((a, b) => a.y - b.y || a.x - b.x);

    // Calculate grid positions
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const original = space.items.find(it => it.id === item.id)!;

      if (i > 0 && i % columns === 0) {
        currentX = 0;
        currentY += rowHeight + spacing;
        rowHeight = 0;
      }

      original.x = currentX;
      original.y = currentY;
      original.rotation = 0; // Reset rotation for clean grid

      rowHeight = Math.max(rowHeight, original.h);
      currentX += original.w + spacing;
    }

    saveSpace(space);

    return {
      content: [{ type: "text" as const, text: `Organized ${space.items.length} items into ${columns}-column grid` }]
    };
  }
);

server.tool(
  "clear_space",
  "Remove all items from a space (keeps the space itself)",
  {
    spaceId: z.string().describe("Space ID to clear"),
  },
  async ({ spaceId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return { content: [{ type: "text" as const, text: `Error: Space not found` }] };
    }

    const count = space.items.length;

    // Delete linked spaces from folders
    for (const item of space.items) {
      if (item.linkedSpaceId) {
        deleteSpace(item.linkedSpaceId);
      }
    }

    space.items = [];
    space.connections = [];
    saveSpace(space);

    return {
      content: [{ type: "text" as const, text: `Cleared ${count} items from "${space.name}"` }]
    };
  }
);

// ============================================
// RESOURCES: Canvas State
// ============================================

server.resource(
  "canvas://spaces",
  "List of all spaces",
  async (uri) => {
    const spaces = listSpaces();
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(spaces.map(s => ({
          id: s.id,
          name: s.name,
          parentId: s.parentId,
          itemCount: s.items.length,
          connectionCount: s.connections.length
        })), null, 2)
      }]
    };
  }
);

// ============================================
// PROMPTS: AI Workflows
// ============================================

server.prompt(
  "brainstorm",
  "Generate ideas and add them as sticky notes to the canvas",
  {
    topic: z.string().describe("Topic to brainstorm about"),
    count: z.string().optional().default("5").describe("Number of ideas to generate"),
  },
  async ({ topic, count = "5" }) => {
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate ${count} creative ideas about "${topic}".

For each idea, use the add_item tool to create a sticky note in the "root" space.
Space them out in a roughly circular pattern around center (0,0), about 300 pixels apart.
Use different pastel colors: bg-yellow-200, bg-pink-200, bg-green-200, bg-blue-200, bg-purple-200.

Make the ideas concise but insightful. Each sticky note content should be 1-2 sentences.`
        }
      }]
    };
  }
);

server.prompt(
  "summarize_space",
  "Analyze and summarize the contents of a space",
  {
    spaceId: z.string().describe("Space ID to analyze"),
  },
  async ({ spaceId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return {
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: `Space "${spaceId}" not found.` }
        }]
      };
    }

    const itemsJson = JSON.stringify(space.items, null, 2);

    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze this canvas space and provide a summary:

Space: ${space.name}
Items: ${space.items.length}
Connections: ${space.connections.length}

Item details:
${itemsJson}

Please provide:
1. A brief overview of what this space contains
2. Key themes or topics identified
3. Suggestions for organization or additions`
        }
      }]
    };
  }
);

server.prompt(
  "layout_suggestions",
  "Get suggestions for organizing canvas items",
  {
    spaceId: z.string().describe("Space to analyze"),
  },
  async ({ spaceId }) => {
    const space = loadSpace(spaceId);
    if (!space) {
      return {
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: `Space "${spaceId}" not found.` }
        }]
      };
    }

    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I have ${space.items.length} items on my canvas. Here are their current positions:

${space.items.map(i => `- ${i.type}: "${i.content.substring(0, 30)}" at (${i.x}, ${i.y})`).join("\n")}

Suggest a better visual arrangement. Consider:
- Grouping related items
- Creating visual hierarchy
- Using space effectively
- Making connections clear

You can use the move_item or organize_items tools to implement your suggestions.`
        }
      }]
    };
  }
);

// ============================================
// Server Startup
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Stacks Canvas MCP Server v1.0.0 running on stdio");
  console.error(`Database: ${join(dataDir, "canvas.db")}`);
}

main().catch(error => {
  console.error("Server startup error:", error);
  process.exit(1);
});
