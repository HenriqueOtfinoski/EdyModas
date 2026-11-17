import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER,
  sizes TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  image TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  image TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  interest TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  env_hash TEXT -- última senha do .env já aplicada (hash), para não sobrescrever a trocada no painel
);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
`;

/** Abre (ou cria) o banco e garante as tabelas. Use ':memory:' em testes. */
export function openDb(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Ajustes em bancos criados por versões anteriores. */
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(admin_users)').all().map((c) => c.name);
  if (!cols.includes('env_hash')) db.exec('ALTER TABLE admin_users ADD COLUMN env_hash TEXT');
}

/** Devolve todas as configurações, com valores JSON já convertidos. */
export function getSettings(db) {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}

/** Grava (insere ou substitui) as chaves informadas. */
export function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(obj)) {
    stmt.run(key, JSON.stringify(value));
  }
}
