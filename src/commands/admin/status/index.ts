import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { baseEmbed } from "../../../functions/discord/embeds";
import { formatDuration } from "../../../functions/time/now";
import type { CommandModule } from "../../../types/Command";

const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show Beartrap latency, performance, and trap counters.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, ctx) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Beartrap status only works inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const config = ctx.services.guildConfig.getGuildConfig(interaction.guild.id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentTraps = ctx.services.guildConfig.countRecentTraps(interaction.guild.id, since);
    const trapped = ctx.services.guildConfig.countTrappedMembers(interaction.guild.id);
    const ghostChannels = ctx.services.guildConfig.countGhostChannels(interaction.guild.id);

    const embed = baseEmbed(
      "Beartrap status",
      "Quiet traps, clean logs, no dramatic ban hammer noises."
    ).addFields(
      { name: "Gateway", value: `${ctx.client.ws.ping}ms`, inline: true },
      { name: "Uptime", value: formatDuration(Date.now() - ctx.startedAt), inline: true },
      { name: "Guilds", value: String(ctx.client.guilds.cache.size), inline: true },
      { name: "Enabled", value: config?.enabled ? "yes" : "no", inline: true },
      { name: "Ghost channels", value: String(ghostChannels), inline: true },
      { name: "Trapped now", value: String(trapped), inline: true },
      { name: "Traps, 24h", value: String(recentTraps), inline: true },
      { name: "Command categories", value: String(ctx.commands.getCategories().size), inline: true },
      { name: "SQLite", value: "online", inline: true }
    );

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
