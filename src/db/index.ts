import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { initializeSchema } from './schema.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function initDb(): void {
  const dir = dirname(config.DATABASE_PATH);
  mkdirSync(dir, { recursive: true });
  _db = new Database(config.DATABASE_PATH);
  initializeSchema(_db);
}
