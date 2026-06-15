import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  MessageFlags,
  type ApplicationCommandDataResolvable,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type InteractionReplyOptions
} from "discord.js";
import type { AppContext } from "../core/AppContext";
import { logger } from "../core/logger";
import type { BeartrapComponentInteraction, CommandModule, LoadedCommand } from "../types/Command";

export class CommandHandler {
  private readonly commands = new Map<string, LoadedCommand>();

  public constructor(private readonly sourceRoot: string) {}

  public async load(): Promise<void> {
    this.commands.clear();

    const glob = new Bun.Glob("commands/*/*/index.ts");
    for await (const relativePath of glob.scan({ cwd: this.sourceRoot, onlyFiles: true })) {
      const filePath = join(this.sourceRoot, relativePath);
      const file = Bun.file(filePath);
      if (!(await file.exists())) continue;

      const moduleUrl = pathToFileURL(filePath).href;
      const imported = (await import(moduleUrl)) as { default?: CommandModule; command?: CommandModule };
      const command = imported.default ?? imported.command;
      if (!command?.data?.name || typeof command.execute !== "function") {
        logger.warn("Skipping invalid command module.", { filePath });
        continue;
      }

      const parts = relativePath.split(/[\\/]/);
      const category = parts[1];
      const folderName = parts[2];
      if (!category || !folderName) {
        logger.warn("Skipping command with invalid path shape.", { relativePath });
        continue;
      }

      this.commands.set(command.data.name, {
        name: command.data.name,
        category,
        folderName,
        filePath,
        module: command
      });
    }

    logger.info("Loaded command modules.", {
      count: this.commands.size,
      categories: [...this.getCategories()]
    });
  }

  public get(name: string): LoadedCommand | undefined {
    return this.commands.get(name);
  }

  public getCategories(): Set<string> {
    return new Set([...this.commands.values()].map((command) => command.category));
  }

  public list(): LoadedCommand[] {
    return [...this.commands.values()];
  }

  public toApplicationCommandData(): ApplicationCommandDataResolvable[] {
    return this.list().map((command) => command.module.data.toJSON() as ApplicationCommandDataResolvable);
  }

  public async registerGuildCommands(guild: Guild): Promise<void> {
    const payload = this.toApplicationCommandData();
    await guild.commands.set(payload);
    logger.info("Registered guild commands.", {
      guildId: guild.id,
      guildName: guild.name,
      count: payload.length
    });
  }

  public async registerAllGuildCommands(client: Client): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      await this.registerGuildCommands(guild).catch((error: unknown) => {
        logger.warn("Failed to register guild commands.", {
          guildId: guild.id,
          guildName: guild.name,
          error
        });
      });
    }
  }

  public async execute(interaction: ChatInputCommandInteraction, ctx: AppContext): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: "Unknown Beartrap command.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await command.module.execute(interaction, ctx);
    } catch (error) {
      logger.error("Command execution failed.", {
        command: interaction.commandName,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error
      });

      const payload: InteractionReplyOptions = {
        content: "Beartrap hit an internal error while handling that command.",
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => undefined);
      } else {
        await interaction.reply(payload).catch(() => undefined);
      }
    }
  }

  public async handleComponent(interaction: BeartrapComponentInteraction, ctx: AppContext): Promise<boolean> {
    for (const command of this.commands.values()) {
      if (!command.module.handleComponent) continue;

      const handled = await command.module.handleComponent(interaction, ctx);
      if (handled) return true;
    }

    return false;
  }
}
