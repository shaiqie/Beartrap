import type { Database } from "bun:sqlite";
import { nowIso } from "../../functions/time/now";
import type {
  BaitTarget,
  BaitTargetType,
  GhostChannelRecord,
  GuildConfig,
  SecurityEvaluation,
  TrappedMemberRecord
} from "../../types/Security";

interface GuildConfigRow {
  guild_id: string;
  admin_log_channel_id: string | null;
  quarantine_role_id: string | null;
  quarantine_category_id: string | null;
  ghost_category_id: string | null;
  ghost_count: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface GhostChannelRow {
  guild_id: string;
  channel_id: string;
  name: string;
  category_id: string | null;
  active: number;
  created_at: string;
}

interface BaitTargetRow {
  guild_id: string;
  target_type: BaitTargetType;
  target_id: string;
  created_at: string;
}

interface JoinRow {
  joined_at: number;
}

interface CountRow {
  count: number;
}

interface TrappedMemberRow {
  guild_id: string;
  user_id: string;
  tarpit_channel_id: string;
  quarantined_at: string;
  released_at: string | null;
}

export interface GuildConfigPatch {
  readonly adminLogChannelId?: string | null;
  readonly quarantineRoleId?: string | null;
  readonly quarantineCategoryId?: string | null;
  readonly ghostCategoryId?: string | null;
  readonly ghostCount?: number;
  readonly enabled?: boolean;
}

type SqlValue = string | number | null;

export class GuildConfigService {
  private readonly configCache = new Map<string, GuildConfig>();
  private readonly ghostCache = new Map<string, Set<string>>();
  private readonly baitCache = new Map<string, BaitTarget[]>();
  private readonly joinCache = new Map<string, number>();

  public constructor(private readonly db: Database) {}

  public getOrCreateGuildConfig(guildId: string): GuildConfig {
    const existing = this.getGuildConfig(guildId);
    if (existing) return existing;

    const createdAt = nowIso();
    this.db
      .query(
        `INSERT INTO guild_configs (guild_id, ghost_count, enabled, created_at, updated_at)
         VALUES (?, 3, 0, ?, ?)`
      )
      .run(guildId, createdAt, createdAt);

    const created = this.getGuildConfig(guildId);
    if (!created) throw new Error(`Failed to create guild config for ${guildId}`);
    return created;
  }

  public getGuildConfig(guildId: string): GuildConfig | null {
    const cached = this.configCache.get(guildId);
    if (cached) return cached;

    const row = this.db
      .query("SELECT * FROM guild_configs WHERE guild_id = ?")
      .get(guildId) as GuildConfigRow | null;

    if (!row) return null;

    const config = this.rowToConfig(row);
    this.configCache.set(guildId, config);
    return config;
  }

  public updateGuildConfig(guildId: string, patch: GuildConfigPatch): GuildConfig {
    this.getOrCreateGuildConfig(guildId);

    const assignments: string[] = [];
    const values: SqlValue[] = [];

    if (patch.adminLogChannelId !== undefined) {
      assignments.push("admin_log_channel_id = ?");
      values.push(patch.adminLogChannelId);
    }
    if (patch.quarantineRoleId !== undefined) {
      assignments.push("quarantine_role_id = ?");
      values.push(patch.quarantineRoleId);
    }
    if (patch.quarantineCategoryId !== undefined) {
      assignments.push("quarantine_category_id = ?");
      values.push(patch.quarantineCategoryId);
    }
    if (patch.ghostCategoryId !== undefined) {
      assignments.push("ghost_category_id = ?");
      values.push(patch.ghostCategoryId);
    }
    if (patch.ghostCount !== undefined) {
      assignments.push("ghost_count = ?");
      values.push(Math.max(1, Math.min(12, Math.floor(patch.ghostCount))));
    }
    if (patch.enabled !== undefined) {
      assignments.push("enabled = ?");
      values.push(patch.enabled ? 1 : 0);
    }

    assignments.push("updated_at = ?");
    values.push(nowIso());
    values.push(guildId);

    this.db.query(`UPDATE guild_configs SET ${assignments.join(", ")} WHERE guild_id = ?`).run(...values);
    this.configCache.delete(guildId);

    const updated = this.getGuildConfig(guildId);
    if (!updated) throw new Error(`Failed to update guild config for ${guildId}`);
    return updated;
  }

  public resetGuild(guildId: string): void {
    this.db.query("DELETE FROM bait_targets WHERE guild_id = ?").run(guildId);
    this.db.query("DELETE FROM ghost_channels WHERE guild_id = ?").run(guildId);
    this.db.query("DELETE FROM trapped_members WHERE guild_id = ?").run(guildId);
    this.db.query("DELETE FROM guild_configs WHERE guild_id = ?").run(guildId);
    this.configCache.delete(guildId);
    this.ghostCache.delete(guildId);
    this.baitCache.delete(guildId);
  }

  public upsertGhostChannel(record: Omit<GhostChannelRecord, "createdAt">): void {
    const createdAt = nowIso();
    this.db
      .query(
        `INSERT INTO ghost_channels (guild_id, channel_id, name, category_id, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, channel_id) DO UPDATE SET
           name = excluded.name,
           category_id = excluded.category_id,
           active = excluded.active`
      )
      .run(
        record.guildId,
        record.channelId,
        record.name,
        record.categoryId,
        record.active ? 1 : 0,
        createdAt
      );

    this.ghostCache.delete(record.guildId);
  }

  public deactivateGhostChannel(guildId: string, channelId: string): void {
    this.db
      .query("UPDATE ghost_channels SET active = 0 WHERE guild_id = ? AND channel_id = ?")
      .run(guildId, channelId);
    this.ghostCache.delete(guildId);
  }

  public listGhostChannels(guildId: string): GhostChannelRecord[] {
    const rows = this.db
      .query("SELECT * FROM ghost_channels WHERE guild_id = ? ORDER BY created_at ASC")
      .all(guildId) as GhostChannelRow[];

    return rows.map((row) => ({
      guildId: row.guild_id,
      channelId: row.channel_id,
      name: row.name,
      categoryId: row.category_id,
      active: row.active === 1,
      createdAt: row.created_at
    }));
  }

  public isGhostChannel(guildId: string, channelId: string): boolean {
    let set = this.ghostCache.get(guildId);
    if (!set) {
      const active = this.listGhostChannels(guildId)
        .filter((record) => record.active)
        .map((record) => record.channelId);
      set = new Set(active);
      this.ghostCache.set(guildId, set);
    }

    return set.has(channelId);
  }

  public addBaitTarget(guildId: string, targetType: BaitTargetType, targetId: string): void {
    this.getOrCreateGuildConfig(guildId);
    this.db
      .query(
        `INSERT INTO bait_targets (guild_id, target_type, target_id, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(guild_id, target_type, target_id) DO NOTHING`
      )
      .run(guildId, targetType, targetId, nowIso());

    this.baitCache.delete(guildId);
  }

  public listBaitTargets(guildId: string): BaitTarget[] {
    const cached = this.baitCache.get(guildId);
    if (cached) return cached;

    const rows = this.db
      .query("SELECT * FROM bait_targets WHERE guild_id = ? ORDER BY created_at ASC")
      .all(guildId) as BaitTargetRow[];

    const targets = rows.map((row) => ({
      guildId: row.guild_id,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at
    }));

    this.baitCache.set(guildId, targets);
    return targets;
  }

  public recordJoin(guildId: string, userId: string, joinedAt: number): void {
    this.db
      .query(
        `INSERT INTO member_join_events (guild_id, user_id, joined_at, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
           joined_at = excluded.joined_at,
           created_at = excluded.created_at`
      )
      .run(guildId, userId, joinedAt, nowIso());

    this.joinCache.set(this.joinKey(guildId, userId), joinedAt);
  }

  public getJoinTimestamp(guildId: string, userId: string): number | null {
    const key = this.joinKey(guildId, userId);
    const cached = this.joinCache.get(key);
    if (cached !== undefined) return cached;

    const row = this.db
      .query("SELECT joined_at FROM member_join_events WHERE guild_id = ? AND user_id = ?")
      .get(guildId, userId) as JoinRow | null;

    if (!row) return null;
    this.joinCache.set(key, row.joined_at);
    return row.joined_at;
  }

  public recordTrapEvent(evaluation: SecurityEvaluation): void {
    this.db
      .query(
        `INSERT INTO trap_events (guild_id, user_id, channel_id, severity, reason, evidence_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        evaluation.evidence.guildId,
        evaluation.evidence.userId,
        evaluation.evidence.channelId,
        evaluation.severity,
        evaluation.reasons.join("; "),
        JSON.stringify(evaluation.evidence),
        nowIso()
      );
  }

  public markTrapped(guildId: string, userId: string, tarpitChannelId: string): void {
    const quarantinedAt = nowIso();
    this.db
      .query(
        `INSERT INTO trapped_members (guild_id, user_id, tarpit_channel_id, quarantined_at, released_at)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
           tarpit_channel_id = excluded.tarpit_channel_id,
           quarantined_at = excluded.quarantined_at,
           released_at = NULL`
      )
      .run(guildId, userId, tarpitChannelId, quarantinedAt);
  }

  public getTrappedMember(guildId: string, userId: string): TrappedMemberRecord | null {
    const row = this.db
      .query("SELECT * FROM trapped_members WHERE guild_id = ? AND user_id = ? AND released_at IS NULL")
      .get(guildId, userId) as TrappedMemberRow | null;

    if (!row) return null;

    return {
      guildId: row.guild_id,
      userId: row.user_id,
      tarpitChannelId: row.tarpit_channel_id,
      quarantinedAt: row.quarantined_at,
      releasedAt: row.released_at
    };
  }

  public countEnabledGuilds(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM guild_configs WHERE enabled = 1").get() as CountRow;
    return Number(row.count);
  }

  public countGhostChannels(guildId?: string): number {
    const row = guildId
      ? (this.db
          .query("SELECT COUNT(*) AS count FROM ghost_channels WHERE guild_id = ? AND active = 1")
          .get(guildId) as CountRow)
      : (this.db.query("SELECT COUNT(*) AS count FROM ghost_channels WHERE active = 1").get() as CountRow);

    return Number(row.count);
  }

  public countTrappedMembers(guildId?: string): number {
    const row = guildId
      ? (this.db
          .query("SELECT COUNT(*) AS count FROM trapped_members WHERE guild_id = ? AND released_at IS NULL")
          .get(guildId) as CountRow)
      : (this.db
          .query("SELECT COUNT(*) AS count FROM trapped_members WHERE released_at IS NULL")
          .get() as CountRow);

    return Number(row.count);
  }

  public countRecentTraps(guildId: string, sinceIso: string): number {
    const row = this.db
      .query("SELECT COUNT(*) AS count FROM trap_events WHERE guild_id = ? AND created_at >= ?")
      .get(guildId, sinceIso) as CountRow;
    return Number(row.count);
  }

  private rowToConfig(row: GuildConfigRow): GuildConfig {
    return {
      guildId: row.guild_id,
      adminLogChannelId: row.admin_log_channel_id,
      quarantineRoleId: row.quarantine_role_id,
      quarantineCategoryId: row.quarantine_category_id,
      ghostCategoryId: row.ghost_category_id,
      ghostCount: row.ghost_count,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private joinKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }
}
