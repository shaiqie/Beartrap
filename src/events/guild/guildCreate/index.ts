import { Events } from "discord.js";
import { logger } from "../../../core/logger";
import type { EventModule } from "../../../types/Event";

const event: EventModule<Events.GuildCreate> = {
  name: Events.GuildCreate,

  async execute(ctx, guild) {
    ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
    await ctx.commands.registerGuildCommands(guild);
    const welcomed = await ctx.services.welcome.sendGuildWelcome(guild).catch((error: unknown) => {
      logger.warn("Failed to send Beartrap guild welcome.", {
        guildId: guild.id,
        guildName: guild.name,
        error
      });
      return false;
    });

    logger.info("Beartrap joined guild.", {
      guildId: guild.id,
      guildName: guild.name,
      welcomed
    });
  }
};

export default event;
