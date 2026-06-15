import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildTextBasedChannel,
  type TextBasedChannel
} from "discord.js";
import type { GuildConfig, LinkIntel, SecurityEvaluation } from "../../types/Security";

export const BEARTRAP_COLOR = 0xd6a24a;
export const BEARTRAP_DANGER_COLOR = 0xd95f59;
export const BEARTRAP_OK_COLOR = 0x6aa56a;

export function baseEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BEARTRAP_COLOR)
    .setTitle(title)
    .setTimestamp(new Date());

  if (description) embed.setDescription(description);
  return embed;
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(title, description).setColor(BEARTRAP_OK_COLOR);
}

export function dangerEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(title, description).setColor(BEARTRAP_DANGER_COLOR);
}

export function formatLinkIntel(linkIntel: LinkIntel): string {
  if (linkIntel.urls.length === 0) return "No URLs found.";

  const lines: string[] = [];
  for (const url of linkIntel.urls.slice(0, 6)) {
    lines.push(`- ${url}`);
  }

  if (linkIntel.redirects.length > 0) {
    lines.push("");
    lines.push("Redirect params:");
    for (const redirect of linkIntel.redirects.slice(0, 4)) {
      lines.push(`- ${redirect.parameter}: ${redirect.decodedTarget}`);
    }
  }

  if (linkIntel.urls.length > 6) {
    lines.push(`- +${linkIntel.urls.length - 6} more`);
  }

  return lines.join("\n").slice(0, 1000);
}

export function securityLogEmbed(evaluation: SecurityEvaluation): EmbedBuilder {
  const embed = dangerEmbed(
    "Beartrap security flag",
    "Beartrap caught a high-confidence automation signal. No public action was taken; the member was contained quietly."
  );

  embed.addFields(
    { name: "User", value: `<@${evaluation.evidence.userId}>`, inline: true },
    { name: "Severity", value: evaluation.severity, inline: true },
    { name: "Score", value: String(evaluation.score), inline: true },
    { name: "Reasons", value: evaluation.reasons.join("\n").slice(0, 1000) || "No reason recorded." },
    { name: "Links", value: formatLinkIntel(evaluation.evidence.linkIntel) }
  );

  return embed;
}

export function lowRiskLogEmbed(evaluation: SecurityEvaluation): EmbedBuilder {
  return baseEmbed(
    "Beartrap low-risk bypass",
    "A member touched a restricted surface, but the profile looked human. Beartrap hid the channel and sent a quiet heads-up."
  )
    .setColor(BEARTRAP_OK_COLOR)
    .addFields(
      { name: "User", value: `<@${evaluation.evidence.userId}>`, inline: true },
      { name: "Score", value: String(evaluation.score), inline: true },
      { name: "Signals", value: evaluation.humanSignals.join("\n").slice(0, 1000) || "human-like content" }
    );
}

export async function sendAdminEmbed(
  guild: Guild,
  config: GuildConfig,
  embed: EmbedBuilder
): Promise<boolean> {
  if (!config.adminLogChannelId) return false;

  const channel = await guild.channels.fetch(config.adminLogChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return false;

  const textChannel = channel as GuildTextBasedChannel & TextBasedChannel;
  await textChannel.send({ embeds: [embed] });
  return true;
}
