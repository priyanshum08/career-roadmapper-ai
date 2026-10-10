import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.js';

const file = process.env.DB_FILE || path.join(ROOT, 'data', 'app.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  constraints TEXT NOT NULL,
  data TEXT NOT NULL,
  progress TEXT NOT NULL DEFAULT '{}',
  share_token TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS advice (
  roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (roadmap_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON roadmaps(user_id, updated_at DESC);
`);
