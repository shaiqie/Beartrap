import { Events } from "discord.js";
import type { EventModule } from "../../../types/Event";

const event: EventModule<Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,

  execute(ctx, member) {
    ctx.services.guildConfig.recordJoin(
      member.guild.id,
      member.id,
      member.joinedTimestamp ?? Date.now()
    );
  }
};

export default event;
