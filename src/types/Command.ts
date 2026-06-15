import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction
} from "discord.js";
import type { AppContext } from "../core/AppContext";

export interface CommandData {
  readonly name: string;
  toJSON(): unknown;
}

export type BeartrapComponentInteraction =
  | ButtonInteraction
  | ChannelSelectMenuInteraction
  | ModalSubmitInteraction
  | RoleSelectMenuInteraction
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction;

export interface CommandModule {
  readonly data: CommandData;
  execute(interaction: ChatInputCommandInteraction, ctx: AppContext): Promise<void>;
  handleComponent?(interaction: BeartrapComponentInteraction, ctx: AppContext): Promise<boolean>;
}

export interface LoadedCommand {
  readonly name: string;
  readonly category: string;
  readonly folderName: string;
  readonly filePath: string;
  readonly module: CommandModule;
}
