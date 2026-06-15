import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type TextChannel
} from "discord.js";
import type { BrandingConfig } from "../../config/branding";
import { BEARTRAP_COLOR } from "../../functions/discord/embeds";

export class WelcomeService {
  public constructor(private readonly branding: BrandingConfig) {}

  public async sendGuildWelcome(guild: Guild): Promise<boolean> {
    const channel = await this.findBestWelcomeChannel(guild);
    if (!channel) return false;

    const embed = new EmbedBuilder()
      .setColor(BEARTRAP_COLOR)
      .setTitle("Hey there, I'm Beartrap")
      .setDescription(
        "Thanks for trusting me with your server. I help catch suspicious automation quietly, collect useful evidence, and keep regular members out of the crossfire. Run `/setup init` when you're ready to wire the traps."
      )
      .setTimestamp(new Date());

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Website")
        .setStyle(ButtonStyle.Link)
        .setURL(this.branding.websiteUrl),
      new ButtonBuilder()
        .setLabel("GitHub")
        .setStyle(ButtonStyle.Link)
        .setURL(this.branding.githubUrl)
    );

    await channel.send({
      embeds: [embed],
      components: [buttons],
      allowedMentions: { parse: [] }
    });

    return true;
  }

  private async findBestWelcomeChannel(guild: Guild): Promise<TextChannel | null> {
    await guild.channels.fetch().catch(() => undefined);
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember) return null;

    const writable = guild.channels.cache
      .filter((channel): channel is TextChannel => channel.type === ChannelType.GuildText)
      .filter((channel) => {
        const permissions = channel.permissionsFor(botMember);
        return (
          permissions?.has(PermissionFlagsBits.ViewChannel) === true &&
          permissions.has(PermissionFlagsBits.SendMessages) &&
          permissions.has(PermissionFlagsBits.EmbedLinks)
        );
      });

    if (writable.size === 0) return null;

    const systemChannel = guild.systemChannel;
    if (systemChannel && writable.has(systemChannel.id)) {
      return systemChannel;
    }

    return (
      writable
        .sort((left, right) => this.compareSnowflakes(right.lastMessageId, left.lastMessageId))
        .first() ?? null
    );
  }

  private compareSnowflakes(left: string | null, right: string | null): number {
    const leftValue = left ? BigInt(left) : 0n;
    const rightValue = right ? BigInt(right) : 0n;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
    return 0;
  }
}
