import { Events } from "discord.js";
import { baseEmbed, formatLinkIntel, sendAdminEmbed } from "../../../functions/discord/embeds";
import type { EventModule } from "../../../types/Event";

const event: EventModule<Events.MessageCreate> = {
  name: Events.MessageCreate,

  async execute(ctx, message) {
    if (!message.guild) return;
    if (message.author.bot && !message.webhookId) return;

    const config = ctx.services.guildConfig.getGuildConfig(message.guild.id);
    if (!config?.enabled) return;

    const linkIntel = ctx.services.linkIntel.analyze(message.content);

    if (!message.author.bot) {
      const trapped = ctx.services.guildConfig.getTrappedMember(message.guild.id, message.author.id);
      if (trapped?.tarpitChannelId === message.channelId) {
        await sendAdminEmbed(
          message.guild,
          config,
          baseEmbed("Beartrap tar-pit payload", `Contained member sent a message in <#${message.channelId}>.`)
            .addFields(
              { name: "User", value: `<@${message.author.id}>`, inline: true },
              { name: "Message", value: message.content.slice(0, 1000) || "(empty)" },
              { name: "Links", value: formatLinkIntel(linkIntel) }
            )
        ).catch(() => undefined);
        return;
      }
    }

    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    const joinedAt =
      ctx.services.guildConfig.getJoinTimestamp(message.guild.id, message.author.id) ??
      member.joinedTimestamp ??
      null;

    if (joinedAt !== null) {
      ctx.services.guildConfig.recordJoin(message.guild.id, message.author.id, joinedAt);
    }

    const baitTargets = ctx.services.guildConfig.listBaitTargets(message.guild.id);
    const mentionedUserIds = [...message.mentions.users.keys()];

    const evaluation = ctx.services.securityEvaluator.evaluate({
      guildId: message.guild.id,
      userId: message.author.id,
      channelId: message.channelId,
      content: message.content,
      createdAt: message.createdTimestamp,
      joinedAt,
      isGhostChannel: ctx.services.guildConfig.isGhostChannel(message.guild.id, message.channelId),
      mentionedUserIds,
      baitTargets,
      webhookId: message.webhookId,
      linkIntel
    });

    if (evaluation.action === "contain") {
      await ctx.services.tarPit.contain(member, evaluation);
      return;
    }

    if (evaluation.action === "bypass") {
      await ctx.services.tarPit.handleHumanBypass(member, message.channelId, evaluation);
    }
  }
};

export default event;
