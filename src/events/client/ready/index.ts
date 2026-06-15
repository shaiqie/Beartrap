import { Events } from "discord.js";
import { logger } from "../../../core/logger";
import type { EventModule } from "../../../types/Event";

const event: EventModule<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,

  async execute(ctx, client) {
    logger.info("Beartrap connected.", {
      user: client.user.tag,
      guilds: client.guilds.cache.size
    });

    await ctx.commands.registerAllGuildCommands(client);

    for (const guild of client.guilds.cache.values()) {
      ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
    }
  }
};

export default event;
