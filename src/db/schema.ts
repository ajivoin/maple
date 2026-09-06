import type Database from 'better-sqlite3';

const DDL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS rss_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  feed_name TEXT,
  last_checked_at INTEGER,
  last_item_guid TEXT,
  last_item_date INTEGER,
  paused INTEGER DEFAULT 0,
  auto_paused INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(channel_id, feed_url)
);
`;

/** Column additions applied to databases created before the column existed. */
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  {
    table: 'rss_subscriptions',
    column: 'auto_paused',
    ddl: `ALTER TABLE rss_subscriptions ADD COLUMN auto_paused INTEGER DEFAULT 0`,
  },
];

export function initializeSchema(db: Database.Database): void {
  db.exec(DDL);

  for (const migration of COLUMN_MIGRATIONS) {
    const columns = db.prepare(`PRAGMA table_info(${migration.table})`).all() as { name: string }[];
    if (!columns.some((col) => col.name === migration.column)) {
      db.exec(migration.ddl);
    }
  }
}
