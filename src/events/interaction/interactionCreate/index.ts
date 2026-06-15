import { Events, MessageFlags } from "discord.js";
import type { EventModule } from "../../../types/Event";

const event: EventModule<Events.InteractionCreate> = {
  name: Events.InteractionCreate,

  async execute(ctx, interaction) {
    if (interaction.isChatInputCommand()) {
      await ctx.commands.execute(interaction, ctx);
      return;
    }

    if (
      interaction.isButton() ||
      interaction.isChannelSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isStringSelectMenu() ||
      interaction.isUserSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      const handled = await ctx.commands.handleComponent(interaction, ctx);
      if (!handled && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Beartrap did not recognize that control.",
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};

export default event;
