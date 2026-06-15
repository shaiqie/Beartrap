import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel
} from "discord.js";
import type { GuildConfigService } from "../config/GuildConfigService";
import type { GuildConfig } from "../../types/Security";

const DEFAULT_GHOST_COUNT = 3;
const GHOST_NAMES = [
  "announcements-2",
  "general-chat",
  "verify-here",
  "rules-info",
  "community-updates",
  "staff-notes",
  "giveaway-entry",
  "server-news",
  "member-screening",
  "welcome-info",
  "support-desk",
  "events-chat"
];

export interface DefaultInfrastructureResult {
  readonly config: GuildConfig;
  readonly adminLogChannelId: string;
  readonly quarantineRoleId: string;
  readonly quarantineCategoryId: string;
  readonly ghostCategoryId: string;
  readonly ghostChannelIds: string[];
}

export class GhostNetworkService {
  public constructor(private readonly configService: GuildConfigService) {}

  public async ensureDefaultInfrastructure(
    guild: Guild,
    setupUserId?: string
  ): Promise<DefaultInfrastructureResult> {
    const botId = guild.client.user?.id;
    if (!botId) throw new Error("Discord client user is not ready.");

    const adminLogChannel = await this.findOrCreateTextChannel(guild, "beartrap-logs", undefined, setupUserId);
    const quarantineRole =
      guild.roles.cache.find((role) => role.name.toLowerCase() === "quarantine") ??
      (await guild.roles.create({
        name: "Quarantine",
        permissions: [],
        reason: "Beartrap setup: quarantine role"
      }));

    const quarantineCategory = await this.findOrCreateCategory(guild, "Beartrap Quarantine", setupUserId);
    const ghostCategory = await this.findOrCreateCategory(guild, "Beartrap Ghosts", setupUserId, true);

    const config = this.configService.updateGuildConfig(guild.id, {
      adminLogChannelId: adminLogChannel.id,
      quarantineRoleId: quarantineRole.id,
      quarantineCategoryId: quarantineCategory.id,
      ghostCategoryId: ghostCategory.id,
      ghostCount: DEFAULT_GHOST_COUNT,
      enabled: true
    });

    const ghostChannels = await this.ensureGhostChannels(guild, config);

    return {
      config,
      adminLogChannelId: adminLogChannel.id,
      quarantineRoleId: quarantineRole.id,
      quarantineCategoryId: quarantineCategory.id,
      ghostCategoryId: ghostCategory.id,
      ghostChannelIds: ghostChannels.map((channel) => channel.id)
    };
  }

  public async ensureGhostChannels(guild: Guild, config: GuildConfig): Promise<TextChannel[]> {
    if (!config.ghostCategoryId) return [];

    const desiredCount = Math.max(1, Math.min(12, config.ghostCount));
    const activeRecords = this.configService.listGhostChannels(guild.id).filter((record) => record.active);
    const channels: TextChannel[] = [];

    for (const record of activeRecords) {
      const channel = await guild.channels.fetch(record.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        this.configService.deactivateGhostChannel(guild.id, record.channelId);
        continue;
      }
      channels.push(channel as TextChannel);
    }

    const usedNames = new Set(channels.map((channel) => channel.name));
    while (channels.length < desiredCount) {
      const name = this.pickGhostName(usedNames);
      usedNames.add(name);

      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: config.ghostCategoryId,
        topic: "Beartrap ghost surface. Legitimate members should not see this channel.",
        rateLimitPerUser: 5,
        permissionOverwrites: this.hiddenOverwrites(guild)
      });

      this.configService.upsertGhostChannel({
        guildId: guild.id,
        channelId: channel.id,
        name: channel.name,
        categoryId: config.ghostCategoryId,
        active: true
      });

      channels.push(channel);
    }

    return channels;
  }

  public async rotateGhostNames(guild: Guild, config: GuildConfig): Promise<number> {
    const records = this.configService.listGhostChannels(guild.id).filter((record) => record.active);
    const used = new Set<string>();
    let rotated = 0;

    for (const record of records) {
      const channel = await guild.channels.fetch(record.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) continue;

      const name = this.pickGhostName(used);
      used.add(name);
      await channel.setName(name, "Beartrap ghost channel rotation");
      this.configService.upsertGhostChannel({
        guildId: guild.id,
        channelId: channel.id,
        name,
        categoryId: config.ghostCategoryId,
        active: true
      });
      rotated += 1;
    }

    return rotated;
  }

  private async findOrCreateTextChannel(
    guild: Guild,
    name: string,
    parentId?: string,
    setupUserId?: string
  ): Promise<TextChannel> {
    const existing = guild.channels.cache.find(
      (channel): channel is TextChannel => channel.type === ChannelType.GuildText && channel.name === name
    );
    if (existing) return existing;

    return guild.channels.create({
      name,
      type: ChannelType.GuildText,
      ...(parentId ? { parent: parentId } : {}),
      topic: "Beartrap administration log channel.",
      permissionOverwrites: this.adminOverwrites(guild, setupUserId)
    });
  }

  private async findOrCreateCategory(
    guild: Guild,
    name: string,
    setupUserId?: string,
    hidden = false
  ): Promise<CategoryChannel> {
    const existing = guild.channels.cache.find(
      (channel): channel is CategoryChannel => channel.type === ChannelType.GuildCategory && channel.name === name
    );
    if (existing) return existing;

    return guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: hidden ? this.hiddenOverwrites(guild) : this.adminOverwrites(guild, setupUserId)
    });
  }

  private hiddenOverwrites(guild: Guild): OverwriteResolvable[] {
    const botId = guild.client.user?.id;
    const overwrites: OverwriteResolvable[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      }
    ];

    if (botId) {
      overwrites.push({
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks
        ]
      });
    }

    return overwrites;
  }

  private adminOverwrites(guild: Guild, setupUserId?: string): OverwriteResolvable[] {
    const overwrites = this.hiddenOverwrites(guild);
    if (setupUserId) {
      overwrites.push({
        id: setupUserId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks
        ]
      });
    }
    return overwrites;
  }

  private pickGhostName(used: Set<string>): string {
    const available = GHOST_NAMES.filter((name) => !used.has(name));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)] ?? available[0] ?? "verify-here";
    }

    return `verify-here-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
