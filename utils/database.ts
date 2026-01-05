import Database from 'better-sqlite3';
import { Space, SpatialItem, Connection } from '../types';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'scratchpad.db');
const MEDIA_DIR = path.join(process.cwd(), 'media');

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
export const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      camera_x REAL DEFAULT 0,
      camera_y REAL DEFAULT 0,
      camera_zoom REAL DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      w REAL NOT NULL,
      h REAL NOT NULL,
      z_index INTEGER NOT NULL,
      rotation REAL DEFAULT 0,
      content TEXT NOT NULL,
      color TEXT,
      metadata TEXT,
      linked_space_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_space_id) REFERENCES spaces(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
      FOREIGN KEY (from_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_items_space ON items(space_id);
    CREATE INDEX IF NOT EXISTS idx_connections_space ON connections(space_id);
    CREATE INDEX IF NOT EXISTS idx_media_item ON media_files(item_id);
  `);
};

// Save media file and return pointer
export const saveMediaFile = (itemId: string, dataUrl: string, filename: string): string => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URL');

  const [, mimetype, base64Data] = matches;
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = mimetype.split('/')[1] || 'bin';
  const filepath = path.join(MEDIA_DIR, `${itemId}.${ext}`);

  fs.writeFileSync(filepath, buffer);

  const stmt = db.prepare(`
    INSERT INTO media_files (id, item_id, filename, filepath, mimetype, size)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(`media-${itemId}`, itemId, filename, filepath, mimetype, buffer.length);

  return filepath;
};

// Load all spaces
export const loadSpaces = (): Record<string, Space> => {
  const spaces: Record<string, Space> = {};

  const spaceRows = db.prepare('SELECT * FROM spaces').all() as any[];
  const itemRows = db.prepare('SELECT * FROM items').all() as any[];
  const connRows = db.prepare('SELECT * FROM connections').all() as any[];

  // Build spaces map
  spaceRows.forEach((row) => {
    spaces[row.id] = {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      camera: { x: row.camera_x, y: row.camera_y, zoom: row.camera_zoom },
      items: [],
      connections: []
    };
  });

  // Add items to spaces
  itemRows.forEach((row) => {
    const item: SpatialItem = {
      id: row.id,
      type: row.type,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      zIndex: row.z_index,
      rotation: row.rotation,
      content: row.content,
      color: row.color,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      linkedSpaceId: row.linked_space_id
    };

    if (spaces[row.space_id]) {
      spaces[row.space_id].items.push(item);
    }
  });

  // Add connections to spaces
  connRows.forEach((row) => {
    const conn: Connection = {
      id: row.id,
      from: row.from_id,
      to: row.to_id
    };

    if (spaces[row.space_id]) {
      spaces[row.space_id].connections.push(conn);
    }
  });

  return spaces;
};

// Save a space
export const saveSpace = (space: Space) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO spaces (id, name, parent_id, camera_x, camera_y, camera_zoom, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
  `);
  stmt.run(
    space.id,
    space.name,
    space.parentId,
    space.camera.x,
    space.camera.y,
    space.camera.zoom
  );
};

// Save an item
export const saveItem = (spaceId: string, item: SpatialItem) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO items
    (id, space_id, type, x, y, w, h, z_index, rotation, content, color, metadata, linked_space_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
  `);
  stmt.run(
    item.id,
    spaceId,
    item.type,
    item.x,
    item.y,
    item.w,
    item.h,
    item.zIndex,
    item.rotation,
    item.content,
    item.color || null,
    item.metadata ? JSON.stringify(item.metadata) : null,
    item.linkedSpaceId || null
  );
};

// Save a connection
export const saveConnection = (spaceId: string, connection: Connection) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO connections (id, space_id, from_id, to_id)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(connection.id, spaceId, connection.from, connection.to);
};

// Delete an item
export const deleteItem = (itemId: string) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
};

// Delete a connection
export const deleteConnection = (connectionId: string) => {
  db.prepare('DELETE FROM connections WHERE id = ?').run(connectionId);
};

// Delete a space and all its items
export const deleteSpace = (spaceId: string) => {
  db.prepare('DELETE FROM spaces WHERE id = ?').run(spaceId);
};

// Save all spaces (bulk operation)
export const saveAllSpaces = (spaces: Record<string, Space>) => {
  const transaction = db.transaction(() => {
    Object.values(spaces).forEach((space) => {
      saveSpace(space);
      space.items.forEach((item) => saveItem(space.id, item));
      space.connections.forEach((conn) => saveConnection(space.id, conn));
    });
  });

  transaction();
};

// Initialize on import
initDatabase();

export default db;
