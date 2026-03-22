import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

// CLAWDESK_DATA_DIR is set by the Tauri wrapper so the DB lives in the OS
// app-data directory (e.g. ~/Library/Application Support/ClawDesk/).
// Falls back to <cwd>/data/ for plain `pnpm dev` usage.
const dataDir = process.env.CLAWDESK_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(dataDir, "clawdesk.db");

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });
    ensureTables(sqlite);
  }
  return _db;
}

function ensureTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runtime_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gateway_url TEXT NOT NULL,
      connection_mode TEXT NOT NULL DEFAULT 'local',
      auth_mode TEXT NOT NULL DEFAULT 'token',
      auth_token TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_source_state (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT NOT NULL REFERENCES runtime_sources(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'disconnected',
      granted_scopes TEXT,
      runtime_version TEXT,
      primary_agent_id TEXT,
      primary_agent_name TEXT,
      last_seen_at TEXT,
      last_probe_at TEXT,
      last_sync_at TEXT,
      degraded_reason TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_agents (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      name TEXT,
      model TEXT,
      status TEXT,
      workspace TEXT,
      raw_json TEXT,
      observed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_sessions (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      agent_id TEXT,
      status TEXT,
      channel TEXT,
      raw_json TEXT,
      observed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_cron_jobs (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      name TEXT,
      schedule TEXT,
      status TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      raw_json TEXT,
      observed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_channels (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      status TEXT,
      raw_json TEXT,
      observed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      runtime_source_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      assigned_agent_id TEXT,
      linked_session_id TEXT,
      linked_cron_job_id TEXT,
      due_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      runtime_source_id TEXT,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT,
      raw_json TEXT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'user',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migrations — SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS,
  // so we try each column and swallow errors if already present.
  const alterCols = [
    "ALTER TABLE tasks ADD COLUMN proof TEXT",
    "ALTER TABLE tasks ADD COLUMN notes TEXT",
  ];
  for (const sql of alterCols) {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
  }
}

export { schema };
