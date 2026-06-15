import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type TextChannel
} from "discord.js";
import { lowRiskLogEmbed, securityLogEmbed, sendAdminEmbed } from "../../functions/discord/embeds";
import { getRemovableIdentityRoleIds } from "../../functions/discord/permissions";
import type { SecurityEvaluation } from "../../types/Security";
import type { GuildConfigService } from "../config/GuildConfigService";
import { logger } from "../../core/logger";

export interface ContainmentResult {
  readonly contained: boolean;
  readonly tarpitChannelId: string | null;
  readonly removedRoleCount: number;
  readonly errors: string[];
}

export class TarPitService {
  public constructor(private readonly configService: GuildConfigService) {}

  public async contain(member: GuildMember, evaluation: SecurityEvaluation): Promise<ContainmentResult> {
    const config = this.configService.getGuildConfig(member.guild.id);
    if (!config?.enabled || !config.quarantineRoleId) {
      return {
        contained: false,
        tarpitChannelId: null,
        removedRoleCount: 0,
        errors: ["Guild is missing enabled config or quarantine role."]
      };
    }

    const errors: string[] = [];
    const botMember = await member.guild.members.fetchMe();
    const removableRoleIds = getRemovableIdentityRoleIds(member, botMember, config.quarantineRoleId);

    if (removableRoleIds.length > 0) {
      await member.roles.remove(removableRoleIds, "Beartrap tar-pit containment").catch((error: unknown) => {
        errors.push(`role_remove_failed:${String(error)}`);
      });
    }

    await member.roles.add(config.quarantineRoleId, "Beartrap tar-pit containment").catch((error: unknown) => {
      errors.push(`quarantine_role_failed:${String(error)}`);
    });

    const tarpitChannel = await this.getOrCreateTarPitChannel(member).catch((error: unknown) => {
      errors.push(`tarpit_channel_failed:${String(error)}`);
      return null;
    });

    if (tarpitChannel) {
      await tarpitChannel
        .send({
          content: "Message received. Some server checks are still catching up, so replies may look delayed.",
          allowedMentions: { parse: [] }
        })
        .catch((error: unknown) => {
          errors.push(`tarpit_message_failed:${String(error)}`);
        });

      this.configService.markTrapped(member.guild.id, member.id, tarpitChannel.id);
    }

    this.configService.recordTrapEvent(evaluation);

    await sendAdminEmbed(member.guild, config, securityLogEmbed(evaluation)).catch((error: unknown) => {
      logger.warn("Failed to send Beartrap admin security log.", {
        guildId: member.guild.id,
        error
      });
    });

    return {
      contained: tarpitChannel !== null,
      tarpitChannelId: tarpitChannel?.id ?? null,
      removedRoleCount: removableRoleIds.length,
      errors
    };
  }

  public async handleHumanBypass(member: GuildMember, channelId: string, evaluation: SecurityEvaluation): Promise<void> {
    const config = this.configService.getGuildConfig(member.guild.id);
    const channel = await member.guild.channels.fetch(channelId).catch(() => null);

    if (channel && "permissionOverwrites" in channel) {
      await channel.permissionOverwrites
        .edit(member.id, { ViewChannel: false }, { reason: "Beartrap human false-positive bypass" })
        .catch((error: unknown) => {
          logger.warn("Failed to hide false-positive channel from member.", {
            guildId: member.guild.id,
            userId: member.id,
            channelId,
            error
          });
        });
    }

    await member
      .send(
        "Hey, quick heads-up from Beartrap. You touched a restricted security channel, so I quietly hid it from you. Nothing else happened. If this feels wrong, contact a server admin."
      )
      .catch(() => undefined);

    this.configService.recordTrapEvent(evaluation);
    if (config) {
      await sendAdminEmbed(member.guild, config, lowRiskLogEmbed(evaluation)).catch(() => undefined);
    }
  }

  private async getOrCreateTarPitChannel(member: GuildMember): Promise<TextChannel> {
    const config = this.configService.getGuildConfig(member.guild.id);
    if (!config) throw new Error("Missing guild config.");

    const existing = this.configService.getTrappedMember(member.guild.id, member.id);
    if (existing) {
      const channel = await member.guild.channels.fetch(existing.tarpitChannelId).catch(() => null);
      if (channel?.type === ChannelType.GuildText) return channel as TextChannel;
    }

    return member.guild.channels.create({
      name: this.tarPitName(member),
      type: ChannelType.GuildText,
      ...(config.quarantineCategoryId ? { parent: config.quarantineCategoryId } : {}),
      topic: `Beartrap tar-pit for ${member.user.tag} (${member.id}).`,
      permissionOverwrites: this.tarPitOverwrites(member.guild, member.id)
    });
  }

  private tarPitOverwrites(guild: Guild, userId: string): OverwriteResolvable[] {
    const botId = guild.client.user?.id;
    const overwrites: OverwriteResolvable[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
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

  private tarPitName(member: GuildMember): string {
    const cleanName = member.user.username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18);
    return `tarpit-${cleanName || "user"}-${member.id.slice(-4)}`;
  }
}
