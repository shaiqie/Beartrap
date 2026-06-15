import type { Database } from "bun:sqlite";

export function migrate(db: Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id TEXT PRIMARY KEY,
      admin_log_channel_id TEXT,
      quarantine_role_id TEXT,
      quarantine_category_id TEXT,
      ghost_category_id TEXT,
      ghost_count INTEGER NOT NULL DEFAULT 3,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ghost_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ghost_channels_active
      ON ghost_channels (guild_id, active);

    CREATE TABLE IF NOT EXISTS bait_targets (
      guild_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('user', 'webhook')),
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, target_type, target_id)
    );

    CREATE TABLE IF NOT EXISTS member_join_events (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS trap_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trap_events_guild_created
      ON trap_events (guild_id, created_at);

    CREATE TABLE IF NOT EXISTS trapped_members (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tarpit_channel_id TEXT NOT NULL,
      quarantined_at TEXT NOT NULL,
      released_at TEXT,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_trapped_members_active
      ON trapped_members (guild_id, released_at);
  `);
}
